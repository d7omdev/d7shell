#!/bin/bash

PID=$(pgrep -x gammastep)

if [ -z "$PID" ]; then
	# Warm filter ON
	gammastep -O 4000 &
else
	# Normal colors
	pkill -x gammastep
fi
