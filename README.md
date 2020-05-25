# sinusbot-birthday-script
Birthday notifications for SinusBot

Sends private message or pokes users on join when someone had birthday.

## Install

1. copy `birthday.js` into your `scripts` folder
2. restart sinusbot
3. fill in admin options in Web GUI
4. activate script in Web GUI

## Admin options

* The message that should be displayed. (%n = nickname, %b = list of birthdays)
```
Hallo %n! Diese Personen haben Geburtstag:
%b
Um deinen eigenen angekündigt zu haben, schreibe einfach z. B.:
!birthday 24.12.
```
* select 'Private chat' or 'Poke'
* send the notification upto N days after birthday
* set a birthday server group by id or name

## Commands

* `!birthdays`
  lists all birthdays
* `!birthday`
  show own birthday
* `!birthday <date>`
  set own birthday, where `<date>` could be `24.12.`, `dec-24`, `12-24`or similar
* `!birtday clear`
  reset own birthday
  
## Setup CardDAV client

Sinusbot doesn't allow direct communication via DAV, so this client runs seperately.
They communicate via `ws://127.0.0.1:23845`, so the DAV program has to run on the same host as Sinusbot.

1. Download `ws-server.js` and `node_modules` into a seperate folder.
```bash
git clone https://github.com/subDesTagesMitExtraKaese/sinusbot-birthday-script/tree/dav-test
cd sinusbot-birthday-script
```

2. Create `secrets.js` and enter your CardDAV server credentials.
```javascript
module.exports = {
  davUrl:         'https://example.com/dav.php',
  davUsername:    'username',
  davPassword:    'password',
  davAddressBook: ''
}
```

3. install node.js
```bash
sudo apt update
sudo apt upgrade -y
sudo apt autoremove
sudo apt install nodejs
```

4. test the program with sinusbot running
```bash
node ws-server.js
```

5. make it run on boot: create `/lib/systemd/system/sinusbot-birthday-sync.service`
```
[Unit]
Description=Sinusbot birthday cardDAV sync service
Wants=network-online.target
After=syslog.target network.target network-online.target

[Service]
User=sinusbot
ExecStart=/usr/bin/node /path/to/your/ws-server.js
WorkingDirectory=/path/to/your
Type=simple

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable sinusbot-birthday-sync.service
sudo systemctl start sinusbot-birthday-sync.service
```