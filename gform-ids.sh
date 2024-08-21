#!/bin/bash
## A simple script for extracting the field ids from a google form.
## Supplied URL must be wrapped in quotes.
## ./gform-ids.sh "https://docs.google.com/"

FILE="gform.html"
if [ -z "$1" ]
  then
    echo "No url supplied."
    exit 1
fi

curl $1 -o $FILE
perl -nle 'print "$1 | $2 " while(/[0-9]{8,10}\,"(.*?)",.*?\[\[([0-9]{8,12})/g)' $FILE
rm $FILE