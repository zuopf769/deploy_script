#!/usr/bin/env bash

TARGET=$1

FILES=${TARGET}/*.png

for oldFullName in ${FILES}
do
  oldBaseName="$(basename ${oldFullName})"
  newFullName=".pqbot_tmp_${oldBaseName}"
  pngquant --output ${newFullName} ${oldFullName}
  oldSize="$(stat -c%s ${oldFullName})"
  newSize="$(stat -c%s ${newFullName})"
  ratioPercentage=$(( 100 - ${newSize} * 100 / ${oldSize} ))
  echo "$1/${oldBaseName}: ${oldSize} => ${newSize}, saved ${ratioPercentage}%"
  if [ "${ratioPercentage}" -gt 10 ]
  then
    mv ${newFullName} ${oldFullName}
    echo "Replaced ${oldFullName} with ${newFullName}"
  else
    rm ${newFullName}
    echo "Removed ${newFullName}"
  fi
done
