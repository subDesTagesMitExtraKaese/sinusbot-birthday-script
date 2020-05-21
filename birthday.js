registerPlugin({
  name: 'Birthday Script',
  version: '1.0',
  description: 'create birthday notifications',
  author: 'mcj201',
  vars: [
    {
      name: 'message',
      title: 'The message that should be displayed. (%n = nickname, %b = list of birthdays)',
      type: 'multiline'
    },
    {
      name: 'type',
      title: 'Message-Type',
      type: 'select',
      options: [
        'Private chat',
        'Poke'
      ]
    },
    {
      name: 'nDays',
      title: 'send the notification upto this amount of days after birthday',
      type: 'number'
    },
    {
      name: 'serverGroup',
      title: 'Server group name/id for birthdays',
      type: 'string'
    }
  ],
  autorun: true
}, function(sinusbot, config, meta) {
  const event = require('event')
  const engine = require('engine')
  const backend = require('backend')
  const format = require('format')
  var store = require('store');

  engine.log(`Loaded ${meta.name} v${meta.version} by ${meta.author}.`)

  event.on('load', () => {
    const command = require('command');
    if (!command) {
        engine.log('command.js library not found! Please download command.js and enable it to be able use this script!');
        return;
    }
    let bDays = store.get('birthdays') || {};
    let notifs = store.get('birthday_notifications') || {};

    setInterval(updateServerGroups, 1000 * 60);

    event.on('clientMove', ({ client, fromChannel }) => {
      const avail = getNotifications(client, 30);
      if (avail.length < 1)
        return;

      let msgs = []
      for(const uid of avail) {
        msgs.push(`${getName(uid)}: ${formatDate(getBday(uid))}`);
      }
      const msg = config.message.replace('%n', client.name()).replace('%b', msgs.join('\r\n'))
      if (!fromChannel) {
        if (config.type == '0') {
          client.chat(msg)
        } else {
          client.poke(msg)
        }
        updateServerGroups();
      }
    })

    command.createCommand('birthdays')
    .help('Show user birthdays')
    .manual('Show user birthdays from DB.')
    .exec((client, args, reply, ev) => {
      let msgs = ["List of saved birthdays:"];
      for(const uid in bDays) {
        msgs.push(`${getName(uid)}: ${formatDate(getBday(uid))}`);
      }
      reply(msgs.join('\r\n'));
      
    });

    command.createCommand('birthday')
    .addArgument(command.createArgument('string').setName('date'))
    .help('Set user birthdays')
    .manual('Save user birthdays to DB.')
    .exec((client, args, reply, ev) => {
      var date = args.date.split('.');
      if(date.length >= 2) {
        let m = date[0];
        date[0] = date[1];
        date[1] = m;
      }

      date = new Date(date);
      if(args.date === "") {
        let date = getBday(ev.client.uid());
        if(date)
          reply(`Your birthday is ${formatDate(date)}.`);
        else
          reply(`Set your birthday first! e.g. !birthday 24.12.`);
      } else if(!isNaN(date)) {
        setBday(ev.client, date);
        reply(`Your birthday was set to ${formatDate(date)}.`);
      } else {
        setBday(ev.client, date);
        reply(`Your birthday has been cleared.`);
      }
      
    });
    
    function setBday(client, date) {
      if(isNaN(date) && bDays[client.uid()]) {
        delete bDays[client.uid()];
      } else if(!isNaN(date)) {
        bDays[client.uid()] = [client.name(), date];
      }
      store.set('birthdays', bDays);
    }
    function getBday(uid) {
      if(!bDays[uid])
        return undefined;
      let [name, date] = bDays[uid];
      if(date)
        return new Date(date);
      else
        return undefined;
    }
    function getName(uid) {
      let [name, date] = bDays[uid];
      return name;
    }

    function getNotifications(client, nDays = 30) {
      const start = new Date();
      start.setDate(start.getDate()-nDays);
      const now = new Date();

      let sentNotifs = notifs[client.uid()] || {};
      let avail = [];
      for(const uid in bDays) {
        let bDay = new Date(bDays[uid][1]);
        bDay.setFullYear((new Date()).getFullYear());
        let lastNotif = new Date(sentNotifs[uid]);
        if(bDay >= start && bDay <= now && (isNaN(lastNotif) || lastNotif < start)) {
          avail.push(uid);
          sentNotifs[uid] = now;
        }
      }
      notifs[client.uid()] = sentNotifs;
      store.set('birthday_notifications', notifs);
      return avail;
    }
  
    function formatDate(dt) {
      if(dt)
        return `${dt.getDate()}.${dt.getMonth()+1}.`;
      else
        return 'invalid date';
    }

    function updateServerGroups() {
      if(config.serverGroup === "")
        return;
      const now = new Date();
      for(const client of backend.getClients()) {
        if(bDays[client.uid()]) {
          const bDay = new Date(bDays[client.uid()][1]);
          let hasGroup = false;
          for(const group of client.getServerGroups()) {
            hasGroup |= group.name() === config.serverGroup || group.id() == config.serverGroup;
          }

          if(bDay.getDate() === now.getDate() && bDay.getMonth() === now.getMonth()) {
            if(!hasGroup) client.addToServerGroup(config.serverGroup);
          } else {
            if(hasGroup) client.removeFromServerGroup(config.serverGroup);
          }
        }
      }
    }
  });
});
