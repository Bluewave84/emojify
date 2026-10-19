import numpy as np
import pandas as pd
from scipy.spatial import KDTree
from skimage import color

class EmojiMatcher:
    """
    K-d-Tree Indexer für den schnellen Farbabgleich von Bildkacheln
    mit Noto-Color-Emojis im CIELAB-Farbraum.
    """
    def __init__(self, csv_path="./public/emoji_analysis_32px.csv"):
        """
        Lädt das analysierte Emoji-Dataset und baut den 3D K-d-Tree auf.
        """
        self.df = pd.read_csv(csv_path)
        # Nur aktive, nicht-aussortierte Emojis verwenden
        self.active_df = self.df[self.df['status'] == 'active'].reset_index(drop=True)
        
        if len(self.active_df) == 0:
            raise ValueError("Keine aktiven Emojis im Dataset gefunden!")
            
        # CIELAB-Koordinaten (L*, a*, b*) auslesen
        self.lab_coords = np.array([self._parse_lab(s) for s in self.active_df['cielab']])
        
        # 3D K-d-Tree im CIELAB-Raum aufbauen
        self.kdtree = KDTree(self.lab_coords)
        print(f"EmojiMatcher erfolgreich initialisiert mit {len(self.active_df)} aktiven Emojis.")
        
    def _parse_lab(self, lab_str):
        clean = str(lab_str).strip('()')
        return [float(x) for x in clean.split(',')]

    def match_tile_srgb(self, r_srgb, g_srgb, b_srgb, top_k=5, use_ciede2000=True):
        """
        Nimmt die durchschnittliche sRGB-Farbe einer Bildkachel (0-255),
        rechnet sie in CIELAB um und liefert das passendste Emoji zurück.
        
        Parameters:
            r_srgb, g_srgb, b_srgb: Integer/Float Werte von 0 bis 255.
            top_k: Anzahl der Kandidaten aus der K-d-Tree Vorauswahl.
            use_ciede2000: Ob ein Re-Ranking mit CIEDE2000 erfolgen soll.
            
        Returns:
            (pd.Series, float): Das gewählte Emoji (Zeile aus DataFrame) und der Farbabstand (Delta E).
        """
        # 1. sRGB in CIELAB konvertieren (Normalisierung 0.0 - 1.0)
        rgb_normalized = np.array([[[r_srgb / 255.0, g_srgb / 255.0, b_srgb / 255.0]]])
        lab_target = color.rgb2lab(rgb_normalized).reshape(3)
        
        if not use_ciede2000 or top_k == 1:
            # Schnelle euklidische Suche im K-d-Tree
            dist, idx = self.kdtree.query(lab_target, k=1)
            return self.active_df.iloc[idx], dist
        else:
            # 2. Top-K Kandidaten über K-d-Tree abfragen
            k_actual = min(top_k, len(self.active_df))
            dists, indices = self.kdtree.query(lab_target, k=k_actual)
            
            if k_actual == 1:
                indices = [indices]
                
            # 3. Exaktes Re-Ranking mittels CIEDE2000
            best_idx = None
            min_delta_e = float('inf')
            
            for cand_idx in indices:
                cand_lab = self.lab_coords[cand_idx]
                delta_e = color.deltaE_ciede2000(lab_target, cand_lab)
                if delta_e < min_delta_e:
                    min_delta_e = delta_e
                    best_idx = cand_idx
                    
            return self.active_df.iloc[best_idx], min_delta_e

if __name__ == "__main__":
    # Test-Lauf
    matcher = EmojiMatcher("./public/emoji_analysis_32px.csv")
    emoji, dist = matcher.match_tile_srgb(240, 20, 40)
    print(f"Match für (240, 20, 40): {emoji['filename']} (Delta E: {dist:.2f})")
