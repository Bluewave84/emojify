import argparse
import os
from pathlib import Path
import numpy as np
import pandas as pd
from PIL import Image
from skimage import color, feature

def analyze_emoji_directory(emoji_dir, output_csv="./public/emoji_analysis_32px.csv", transparent_threshold=70.0, edge_threshold=25.0):
    """
    Analysiert alle 32px PNG-Color-Emojis in einem Verzeichnis und berechnet:
    - Transparenzanteil (Alpha-Kanal)
    - sRGB-Mittelwert der opaken Pixel
    - CIELAB (L*, a*, b*) Umrechnung
    - Kantendichte (Canny-Filter)
    
    Filtert ungeeignete Emojis automatisch heraus.
    """
    results = []
    
    if not os.path.exists(emoji_dir):
        print(f"Hinweis: Ordner '{emoji_dir}' nicht gefunden. Bitte Pfad anpassen.")
        return None
        
    for filename in sorted(os.listdir(emoji_dir)):
        if not filename.endswith('.png'):
            continue
            
        filepath = os.path.join(emoji_dir, filename)
        img = Image.open(filepath).convert("RGBA")
        arr = np.array(img)  # Shape: (32, 32, 4)
        
        alpha = arr[:, :, 3]
        total_pixels = arr.shape[0] * arr.shape[1]
        transparent_ratio = (np.sum(alpha == 0) / total_pixels) * 100.0
        
        opaque_mask = alpha > 0
        if np.any(opaque_mask):
            # 1. sRGB Mittelwert nur über opake Pixel
            rgb_pixels = arr[opaque_mask, :3] / 255.0
            mean_srgb = np.mean(rgb_pixels, axis=0)
            r, g, b = (mean_srgb * 255.0).astype(int)
            
            # 2. CIELAB Umrechnung (Standard D65 Observer)
            lab_pixels = color.rgb2lab(rgb_pixels.reshape(1, -1, 3))
            mean_lab = np.mean(lab_pixels, axis=(0, 1))
            L_val, a_val, b_val = mean_lab[0], mean_lab[1], mean_lab[2]
            
            # 3. Kantendichte (Canny-Filter auf Graustufenkanal)
            gray = color.rgb2gray(arr[:, :, :3] / 255.0)
            edges = feature.canny(gray, sigma=1.0, mask=opaque_mask)
            edge_density = (np.sum(edges) / np.sum(opaque_mask)) * 100.0
        else:
            r, g, b = 0, 0, 0
            L_val, a_val, b_val = 0.0, 0.0, 0.0
            edge_density = 0.0
            
        # Filter-Logik
        status = "active"
        reason = "Geeignet"
        if transparent_ratio > transparent_threshold:
            status = "inactive"
            reason = f"Aussortiert: Transparenzanteil zu hoch (>{transparent_threshold}%)"
        elif edge_density > edge_threshold:
            status = "inactive"
            reason = f"Aussortiert: Kantendichte zu hoch (>{edge_threshold}%)"
            
        results.append({
            "filename": filename,
            "srgb": f"({r}, {g}, {b})",
            "cielab": f"({L_val:.1f}, {a_val:.1f}, {b_val:.1f})",
            "transparency": round(transparent_ratio, 1),
            "edge-density": round(edge_density, 1),
            "status": status,
            "reason": reason
        })
        
    df = pd.DataFrame(results)
    df.to_csv(output_csv, index=False)
    print(f"Analyse abgeschlossen. Ergebnisse in '{output_csv}' gespeichert.")
    return df

def main(argv=None):
    parser = argparse.ArgumentParser(description="Analyze 32px Noto Emoji PNG files.")
    parser.add_argument(
        "--source",
        default=os.environ.get("NOTO_EMOJI_DIR"),
        help="Noto Emoji checkout, its 2D folder, or a PNG directory (default: NOTO_EMOJI_DIR).",
    )
    args = parser.parse_args(argv)
    if not args.source:
        parser.error("Pass --source or set NOTO_EMOJI_DIR.")

    source = Path(args.source).expanduser()
    candidates = (source, source / "png" / "32", source / "2D" / "png" / "32")
    emoji_dir = next(
        (directory for directory in candidates
         if directory.is_dir() and any(file.is_file() for file in directory.glob("*.png"))),
        None,
    )
    if emoji_dir is None:
        parser.error(f"No PNG files found in '{source}'. Expected a PNG directory or Noto Emoji checkout.")
    analyze_emoji_directory(emoji_dir)


if __name__ == "__main__":
    main()
