# sinusbot-birthday-script
Birthday notifications for SinusBot

Sends private message or pokes users on join when someone had birthday.

## Admin options:

* The message that should be displayed. (%n = nickname, %b = list of birthdays)
* select 'Private chat' or 'Poke'
* send the notification upto N days after birthday
* set a birthday server group by id or name

## Commands:

* `!birthdays`
  lists all birthdays
* `!birthday`
  show own birthday
* `!birthday <date>`
  set own birthday, where `<date>` could be `24.12.`, `dec-24`, `12-24`or similar
* `!birtday clear`
  reset own birthday
  
