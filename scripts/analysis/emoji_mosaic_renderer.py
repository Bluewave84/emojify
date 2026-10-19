import os
import numpy as np
import pandas as pd
from PIL import Image
from skimage import color
from scipy.spatial import KDTree

class EmojiMatcher:
    def __init__(self, csv_path):
        """
        Lädt die analysierten Emoji-Metadaten und baut einen 3D K-d-Tree im CIELAB-Farbraum auf.
        """
        self.df = pd.read_csv(csv_path)
        self.active_df = self.df[self.df['status'] == 'active'].reset_index(drop=True)
        self.name_col = 'filename'
        self.lab_coords = np.array([self._parse_lab(s) for s in self.active_df['cielab']])
        self.kdtree = KDTree(self.lab_coords)
        
    def _parse_lab(self, lab_str):
        clean = lab_str.strip('()')
        return [float(x) for x in clean.split(',')]

    def match_tile_srgb(self, r_srgb, g_srgb, b_srgb, top_k=5, use_ciede2000=True):
        """
        Nimmt die durchschnittliche sRGB-Farbe einer Bildkachel (0-255),
        konvertiert sie in CIELAB und liefert das passendste Emoji zurück.
        """
        rgb_normalized = np.array([[[r_srgb / 255.0, g_srgb / 255.0, b_srgb / 255.0]]])
        lab_target = color.rgb2lab(rgb_normalized).reshape(3)
        
        if not use_ciede2000 or top_k == 1:
            dist, idx = self.kdtree.query(lab_target, k=1)
            return self.active_df.iloc[idx][self.name_col], dist
        else:
            dists, indices = self.kdtree.query(lab_target, k=min(top_k, len(self.active_df)))
            if isinstance(indices, (int, np.integer)):
                indices = [indices]
            
            best_idx = indices[0]
            min_delta_e = float('inf')
            
            for cand_idx in indices:
                cand_lab = self.lab_coords[cand_idx]
                delta_e = color.deltaE_ciede2000(lab_target, cand_lab)
                if delta_e < min_delta_e:
                    min_delta_e = delta_e
                    best_idx = cand_idx
                    
            return self.active_df.iloc[best_idx][self.name_col], min_delta_e


class EmojiMosaicRenderer:
    def __init__(self, matcher, emoji_dir=None):
        """
        Renderer zur Mosaikerstellung mit variabler Kachel- und Emoji-Größe.
        
        :param matcher: Instanz von EmojiMatcher
        :param emoji_dir: Ordnerpfad zu den Emoji PNG-Dateien (optional)
        """
        self.matcher = matcher
        self.emoji_dir = emoji_dir
        self._emoji_cache = {}  # Cache für skalierte Emojis zur Performance-Optimierung

    def _get_emoji_image(self, emoji_filename, tile_size):
        """
        Lädt ein Emoji-Bild und skaliert es auf die gewünschte Kachelgröße (tile_size).
        Nutzt Caching, um mehrfaches Laden derselben Datei zu vermeiden.
        """
        cache_key = (emoji_filename, tile_size)
        if cache_key in self._emoji_cache:
            return self._emoji_cache[cache_key]

        name_col = self.matcher.name_col
        
        # Falls Dateiendung fehlt, .png anfügen
        if not emoji_filename.endswith('.png'):
            actual_filename = f"{emoji_filename}.png"
        else:
            actual_filename = emoji_filename

        if self.emoji_dir and os.path.exists(os.path.join(self.emoji_dir, actual_filename)):
            filepath = os.path.join(self.emoji_dir, actual_filename)
            emoji_img = Image.open(filepath).convert("RGBA")
        else:
            # Fallback: Falls lokale PNGs fehlen, erzeugen wir ein Farbfeld aus der CIELAB/sRGB-Analyse
            row = self.matcher.active_df[self.matcher.active_df[name_col] == emoji_filename]
            if not row.empty:
                srgb_str = row.iloc[0]['srgb'].strip('()')
                r, g, b = [int(x) for x in srgb_str.split(',')]
            else:
                r, g, b = (128, 128, 128)
            emoji_img = Image.new("RGBA", (32, 32), (r, g, b, 255))

        # Skalieren auf die konfigurierte Kachelgröße (tile_size x tile_size)
        resized_emoji = emoji_img.resize((tile_size, tile_size), Image.Resampling.LANCZOS)
        self._emoji_cache[cache_key] = resized_emoji
        return resized_emoji

    def render(self, input_image_path, tile_size=32, blend_ratio=0.0, output_path=None):
        """
        Erstellt das Emoji-Mosaik aus einem Eingabebild.
        
        :param input_image_path: Pfad zum Quellbild
        :param tile_size: Kachelgröße in Pixeln (z. B. 16, 24, 32, 48, 64)
        :param blend_ratio: Optionaler Mischanteil (0.0 = reines Mosaik, >0.0 blendet Originalbild leicht ein)
        :param output_path: Speicherpfad für das Ausgabebild
        :return: PIL Image des Mosaiks
        """
        img = Image.open(input_image_path).convert("RGB")
        w, h = img.size

        # Raster-Dimensionen berechnen
        grid_w = max(1, w // tile_size)
        grid_h = max(1, h // tile_size)

        # Quellbild exakt auf Rastergröße bringen
        target_w = grid_w * tile_size
        target_h = grid_h * tile_size
        img_resized = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
        img_arr = np.array(img_resized)

        # Ausgabecanvas initialisieren (RGBA)
        mosaic = Image.new("RGBA", (target_w, target_h), (255, 255, 255, 255))

        for row in range(grid_h):
            for col in range(grid_w):
                # Kachelbereich (ROI) extrahieren
                y1 = row * tile_size
                y2 = y1 + tile_size
                x1 = col * tile_size
                x2 = x1 + tile_size

                tile_pixels = img_arr[y1:y2, x1:x2]
                
                # sRGB-Durchschnittsfarbe der Kachel berechnen
                mean_r = int(np.mean(tile_pixels[:, :, 0]))
                mean_g = int(np.mean(tile_pixels[:, :, 1]))
                mean_b = int(np.mean(tile_pixels[:, :, 2]))

                # Bestes Emoji via CIELAB K-d-Tree ermitteln
                best_emoji_file, _ = self.matcher.match_tile_srgb(mean_r, mean_g, mean_b)

                # Emoji laden und auf Kachelgröße skalieren
                emoji_tile = self._get_emoji_image(best_emoji_file, tile_size)

                # Auf Canvas platzieren
                mosaic.paste(emoji_tile, (x1, y1), emoji_tile)

        # Optionales Alpha-Blending mit dem Quellbild für gesteigerten Detailgrad
        if blend_ratio > 0.0:
            blend_ratio = min(max(blend_ratio, 0.0), 1.0)
            orig_rgba = img_resized.convert("RGBA")
            mosaic = Image.blend(mosaic, orig_rgba, alpha=blend_ratio)

        if output_path:
            mosaic.save(output_path)

        return mosaic


if __name__ == "__main__":
    csv_file = "/workspace/artifacts/emoji_analysis_32px.csv"
    if not os.path.exists(csv_file):
        csv_file = "/workspace/scratch/emoji_analysis_32px.csv"

    matcher = EmojiMatcher(csv_file)
    renderer = EmojiMosaicRenderer(matcher=matcher)

    # Erzeuge Testbild (256x256 Farbverlauf)
    test_img = Image.new("RGB", (256, 256))
    pixels = test_img.load()
    for y in range(256):
        for x in range(256):
            pixels[x, y] = (x, y, (x + y) // 2)

    test_input_path = "/workspace/scratch/test_input.png"
    test_output_path = "/workspace/scratch/test_mosaic_output.png"
    test_img.save(test_input_path)

    # Rendere Mosaik mit variabler Kachelgröße (z. B. 16px)
    result_mosaic = renderer.render(
        input_image_path=test_input_path,
        tile_size=16,
        blend_ratio=0.0,
        output_path=test_output_path
    )
    print(f"Mosaik erfolgreich erstellt! Größe: {result_mosaic.size}, Kachelgröße: 16px")
