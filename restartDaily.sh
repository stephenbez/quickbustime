#!/bin/bash

# quickbustime is run using forever
source /home/steve/.nvm/nvm.sh
nvm use v0.10.28
forever restart main.js
