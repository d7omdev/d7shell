#!/usr/bin/env python3
"""Fallback color generation for wallpaper theming + starship/SCSS output"""

import sys
import json
from pathlib import Path
import os

PROJECT_PATH = Path.home() / "Projects/d7shell"
SCSS_FILE = PROJECT_PATH / "style/colors.scss"
STARSHIP_TEMPLATE = Path.home() / ".config/matugen/templates/starship-colors.toml"
STARSHIP_CONFIG = Path.home() / ".config/starship.toml"


def generate_fallback_colors(is_dark=True):
    """Generate a basic Material Design color palette"""
    if is_dark:
        colors = {
            "background": "#131318",
            "surface": "#131318",
            "primary": "#c6bfff",
            "secondary": "#c8c3dc",
            "tertiary": "#ebb8cf",
            "on_background": "#e5e1e9",
            "on_surface": "#e5e1e9",
            "on_primary": "#2e295f",
            "on_secondary": "#302e41",
            "on_tertiary": "#482537",
            "surface_variant": "#47464f",
            "on_surface_variant": "#c9c5d0",
            "outline": "#928f99",
            "outline_variant": "#47464f",
            "primary_container": "#454077",
            "on_primary_container": "#e4dfff",
            "secondary_container": "#474459",
            "on_secondary_container": "#e4dff9",
            "tertiary_container": "#613b4e",
            "on_tertiary_container": "#ffd8e8",
            "inverse_surface": "#e5e1e9",
            "inverse_on_surface": "#313036",
            "inverse_primary": "#5d5791",
            "scrim": "#000000",
            "shadow": "#000000",
            "surface_tint": "#c6bfff",
        }
    else:
        colors = {
            "background": "#fefbff",
            "surface": "#fefbff",
            "primary": "#5d5791",
            "secondary": "#625b71",
            "tertiary": "#7d5260",
            "on_background": "#1c1b1f",
            "on_surface": "#1c1b1f",
            "on_primary": "#ffffff",
            "on_secondary": "#ffffff",
            "on_tertiary": "#ffffff",
            "surface_variant": "#e7e0ec",
            "on_surface_variant": "#49454f",
            "outline": "#79747e",
            "outline_variant": "#cab6d0",
            "primary_container": "#e4dfff",
            "on_primary_container": "#191249",
            "secondary_container": "#e8def8",
            "on_secondary_container": "#1d192b",
            "tertiary_container": "#ffd8e4",
            "on_tertiary_container": "#31111d",
            "inverse_surface": "#313033",
            "inverse_on_surface": "#f4f0f4",
            "inverse_primary": "#c6bfff",
            "scrim": "#000000",
            "shadow": "#000000",
            "surface_tint": "#5d5791",
        }
    return colors


def write_scss(colors, mode):
    SCSS_FILE.parent.mkdir(parents=True, exist_ok=True)
    scss_content = "@use 'sass:color';\n\n"
    for name, hex_color in colors.items():
        scss_content += f"${name}: {hex_color};\n"
    scss_content += f"\n$theme: '{mode}';\n"

    SCSS_FILE.write_text(scss_content)
    print(f"SCSS colors written to {SCSS_FILE}")


def write_starship(colors, mode):
    if not STARSHIP_TEMPLATE.exists():
        print(f"Starship template not found: {STARSHIP_TEMPLATE}")
        return
    template_content = STARSHIP_TEMPLATE.read_text()
    for key, value in colors.items():
        template_content = template_content.replace(
            f"{{{{colors.{mode}.{key}}}}}", value
        )
    STARSHIP_CONFIG.write_text(template_content)
    print(f"Starship config written to {STARSHIP_CONFIG}")


def main():
    if len(sys.argv) != 3:
        print("Usage: extract-colors.py <image_path> <dark|light>")
        sys.exit(1)
    image_path = Path(sys.argv[1])
    mode = sys.argv[2].lower()
    if mode not in ["dark", "light"]:
        print("Mode must be 'dark' or 'light'")
        sys.exit(1)
    if not image_path.exists():
        print(f"Image file not found: {image_path}")
        sys.exit(1)

    # Generate fallback colors
    colors = generate_fallback_colors(is_dark=(mode == "dark"))

    # Write SCSS and Starship
    write_scss(colors, mode)
    write_starship(colors, mode)


if __name__ == "__main__":
    main()
