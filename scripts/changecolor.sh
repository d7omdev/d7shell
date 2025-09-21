#!/bin/zsh
# Get wallpaper path and theme mode
wallpaper="$1"
mode="$2"
project_path="$HOME/.config/ags"

# Generate colors based on the specified mode
if [ "$mode" = "light" ]; then
	# Apply light theme
	echo "Generating light theme colors from wallpaper..."
	matugen image "$wallpaper" -m light --dry-run --json hex >/tmp/matugen_colors.json 2>/dev/null
	gsettings set org.gnome.desktop.interface color-scheme prefer-light
	theme="Light Theme"
elif [ "$mode" = "dark" ]; then
	# Apply dark theme
	echo "Generating dark theme colors from wallpaper..."
	matugen image "$wallpaper" -m dark --dry-run --json hex >/tmp/matugen_colors.json 2>/dev/null
	gsettings set org.gnome.desktop.interface color-scheme prefer-dark
	theme="Dark Theme"
else
	# Invalid mode specified
	echo "Usage: $0 <wallpaper_path> <mode>"
	echo "Mode options: light, dark"
	exit 1
fi

# Generate colors and apply templates (including Starship)
echo "Generating colors and applying templates..."
matugen image "$wallpaper" -m "$mode" -c "$HOME/.config/matugen/config.toml" 2>/dev/null ||
	echo "Warning: some templates might need manual fixes"


# Reload Starship in current shell
if command -v starship >/dev/null 2>&1; then
    eval "$(starship init zsh)"  # or bash depending on your shell
fi


# Check if color generation was successful
if [ ! -f "/tmp/matugen_colors.json" ] || [ ! -s "/tmp/matugen_colors.json" ]; then
	echo "Warning: matugen color generation failed, using fallback colors"
	python3 "$project_path/scripts/extract-colors.py" "$wallpaper" "$mode" >/tmp/matugen_colors.json 2>/dev/null

	if [ ! -f "/tmp/matugen_colors.json" ] || [ ! -s "/tmp/matugen_colors.json" ]; then
		echo "Error: Both matugen and fallback color generation failed"
		exit 1
	fi
fi

# Generate the SCSS file from JSON
echo "Writing colors to $project_path/style/colors.scss..."
python3 - <<EOF
import json
import sys
import os

try:
    with open('/tmp/matugen_colors.json', 'r') as f:
        data = json.load(f)

    # Handle matugen JSON structure
    colors_data = data.get('colors', {})
    scheme = '$mode' if '$mode' == 'light' else 'dark'

    # Get the colors for the current scheme
    if scheme in colors_data:
        colors = colors_data[scheme]
    else:
        colors = colors_data.get('dark', colors_data.get('light', {}))

    scss_content = '@use "sass:color";\n\n'

    # Generate SCSS variables from matugen colors
    for name, hex_color in colors.items():
        if isinstance(hex_color, str) and hex_color.startswith('#'):
            scss_content += f'\${name}: {hex_color};\n\n'

    # Add theme variable
    scss_content += f'\$theme: "{scheme}";\n'

    # Add compatibility variables for existing SCSS (map Material Design colors to legacy names)
    scss_content += '\n// Legacy color compatibility\n'
    if 'error' in colors:
        scss_content += f'\$red: {colors["error"]};\n'
        scss_content += f'\$red_source: {colors["error"]};\n'
        scss_content += f'\$red_value: {colors["error"]};\n'
        if 'on_error' in colors:
            scss_content += f'\$on_red: {colors["on_error"]};\n'
        else:
            scss_content += '\$on_red: #ffffff;\n'
    if 'primary' in colors:
        scss_content += f'\$blue: {colors["primary"]};\n'
        scss_content += f'\$blue_source: {colors["primary"]};\n'
        scss_content += f'\$blue_value: {colors["primary"]};\n'
        if 'on_primary' in colors:
            scss_content += f'\$on_blue: {colors["on_primary"]};\n'
        else:
            scss_content += '\$on_blue: #ffffff;\n'
    if 'tertiary' in colors:
        scss_content += f'\$purple: {colors["tertiary"]};\n'
        scss_content += f'\$purple_source: {colors["tertiary"]};\n'
        scss_content += f'\$purple_value: {colors["tertiary"]};\n'
        if 'on_tertiary' in colors:
            scss_content += f'\$on_purple: {colors["on_tertiary"]};\n'
        else:
            scss_content += '\$on_purple: #ffffff;\n'
    if 'secondary' in colors:
        scss_content += f'\$green: {colors["secondary"]};\n'
        scss_content += f'\$green_source: {colors["secondary"]};\n'
        scss_content += f'\$green_value: {colors["secondary"]};\n'
        if 'on_secondary' in colors:
            scss_content += f'\$on_green: {colors["on_secondary"]};\n'
        else:
            scss_content += '\$on_green: #ffffff;\n'

    # Add some default colors if not present
    scss_content += '\$yellow: #f9e2af;\n'
    scss_content += '\$yellow_source: #f9e2af;\n'
    scss_content += '\$yellow_value: #f9e2af;\n'
    scss_content += '\$on_yellow: #452b00;\n'
    scss_content += '\$orange: #fab387;\n'
    scss_content += '\$orange_source: #fab387;\n'
    scss_content += '\$orange_value: #fab387;\n'
    scss_content += '\$on_orange: #55200d;\n'
    scss_content += '\n'

    # Add transparency variables (after all color variables are defined)
    if 'surface' in colors:
        scss_content += '\$surface_transparent: color.scale(\$surface, \$alpha: -20%);\n'
    if 'inverse_surface' in colors:
        scss_content += '\$inverse_surface_transparent: color.scale(\$inverse_surface, \$alpha: -92%);\n'
        scss_content += '\$inverse_surface_transparent_variant: color.scale(\n  \$inverse_surface,\n  \$alpha: -82%\n);\n'
        scss_content += '\$inverse_surface_transparent_overlay: linear-gradient(\n  0deg,\n  \$inverse_surface_transparent,\n  \$inverse_surface_transparent\n);\n'
        scss_content += '\$inverse_surface_transparent_variant_overlay: linear-gradient(\n  0deg,\n  \$inverse_surface_transparent_variant,\n  \$inverse_surface_transparent_variant\n);\n'

    project_path = os.path.expanduser('~/.config/ags')
    colors_file = os.path.join(project_path, 'style', 'colors.scss')

    with open(colors_file, 'w') as f:
        f.write(scss_content)

    print("Colors generated successfully!")

except Exception as e:
    print(f"Error generating colors: {e}")
    sys.exit(1)
EOF

# Set wallpaper using swww
echo "Setting wallpaper with swww..."
if command -v swww >/dev/null 2>&1; then
	# Ensure swww daemon is running
	if ! pgrep -x "swww-daemon" >/dev/null; then
		echo "Starting swww daemon..."
		swww init 2>/dev/null &
		sleep 2
	fi

	# Check if file is a GIF
	if [[ "$wallpaper" == *.gif ]] || [[ "$wallpaper" == *.GIF ]]; then
		echo "Setting animated GIF wallpaper..."
		swww img "$wallpaper" --transition-type grow --transition-duration 1.5
	else
		echo "Setting static wallpaper..."
		swww img "$wallpaper" --transition-type wipe --transition-angle 30 --transition-duration 2
	fi
	echo "Wallpaper set successfully: $(basename "$wallpaper")"
else
	echo "Warning: swww not found, wallpaper not set"
	echo "Install swww for wallpaper support: https://github.com/Horus645/swww"
fi

# Trigger AGS to recompile CSS
echo "Triggering AGS CSS recompilation..."
touch "$project_path/style/colors.scss"

# Small delay to allow file watcher to detect changes
sleep 1

# Reload Hyprland and apply effects
hyprctl reload 2>/dev/null || echo "Hyprland not running"
hyprshade on vibrance 2>/dev/null || echo "Hyprshade not available"

# Clean up temporary file
rm -f /tmp/matugen_colors.json

echo "Theme switched to: $theme"

# Send notification
if command -v notify-send >/dev/null 2>&1; then
	wallpaper_name=$(basename "$wallpaper")
	if [[ "$wallpaper" == *.gif ]] || [[ "$wallpaper" == *.GIF ]]; then
		notify-send "🎨 Theme & Wallpaper Changed" "Animated wallpaper: $wallpaper_name\nTheme: $theme" -a "d7shell-colorgen" -t 3000
	else
		notify-send "🎨 Theme & Wallpaper Changed" "Wallpaper: $wallpaper_name\nTheme: $theme" -a "d7shell-colorgen" -t 3000
	fi
fi
