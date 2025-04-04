#!/bin/bash
## A simple script for extracting the field ids from a google form.
## Supplied URL must be wrapped in quotes.
## ./gform-ids.sh "https://docs.google.com/"

function yes_or_no {
    while true; do
        read -p "$* [y/n]: " yn
        case $yn in
            [Yy]*) return 0  ;;  
            [Nn]*) echo "Aborted" ; return  1 ;;
        esac
    done
}

FILE="gform.html"
if [ ! -f $FILE ]
  then
    echo "gform.html is missing!."
    exit 1
fi

perl -nle 'print "$1 | $2 " while(/[0-9]{8,10}\,"(.*?)",.*?\[\[([0-9]{8,12})/g)' $FILE

yes_or_no "Remove gform.html?" && rm $FILE