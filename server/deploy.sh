echo 'Deploy '
ssh user@YOUR_SERVER_IP 'cd makers21/server/ && git pull & pm2 restart 3 & pm2 restart 2'

