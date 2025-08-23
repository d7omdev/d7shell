#!/bin/bash

PID=$(pgrep -x gammastep)

if [ -z "$PID" ]; then
	# Warm filter ON
	gammastep -O 4000 &
	notify-send -i weather-clear-night "Warm filter ON (4000K)"
else
	# Normal colors
	pkill -x gammastep
	notify-send -i display "Normal colors restored"
fi
