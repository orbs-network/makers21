echo 'Deploy '
ssh doron@34.134.236.209 'cd makers21/server/ && git pull & pm2 restart 3 & pm2 restart 2'

