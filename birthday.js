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
    },
    {
      name: 'davUrl',
      title: 'CardDAV URL e.g. https://example.com/dav.php',
      type: 'string'
    },
    {
      name: 'davUsername',
      title: 'CardDAV username',
      type: 'string'
    },
    {
      name: 'davPassword',
      title: 'CardDAV password',
      type: 'password'
    },
    {
      name: 'davAddressBook',
      title: 'CardDAV address book',
      type: 'text'
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

    var xhr = new dav.transport.Basic(
      new dav.Credentials({
        username: config.davUsername,
        password: config.davPassword
      })
    );
    
    
    let bDays = store.get('birthdays') || {};
    let notifs = store.get('birthday_notifications') || {};
    
    let davClient = new dav.Client(xhr);
    let usedAddressBook = null;

    davClient.createAccount({
      server: config.davUrl,
      accountType: 'carddav'
    }).then(function(account) {
      let addressBook = null;
      account.addressBooks.forEach(function(ab) {
        console.log('Found address book name ' + ab.displayName);
        addressBook = ab;
        if(ab.displayName === config.davAddressBook) return;
      });
      usedAddressBook = addressBook;
    });

    setInterval(updateServerGroups, 1000 * 60);
    setInterval(syncDavAddressBook, 1000 * 60);

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
        bDays[client.uid()] = [client.name(), date, new Date()];
      }
      store.set('birthdays', bDays);
    }
    function getBday(uid) {
      if(!bDays[uid])
        return undefined;
      if(bDays[uid][1])
        return new Date(bDays[uid][1]);
      else
        return undefined;
    }
    function getName(uid) {
      return bDays[uid][0];
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
    function syncDavAddressBook() {
      if(!usedAddressBook)
        return;
      
      davClient.syncAddressBook(usedAddressBook).then(function(x) {
        let remoteBDays = {};
        let hasUpdates = false;

        for(const vcard of x.objects) {
          VCF.parse(vcard.addressData, function(card) {
            if(!isnan(card.bday) && card.note && card.note.length > 0) {
              const uid = card.note[0]
              remoteBDays[uid] = [card.fn, card.bday, card.rev];
              if(!bDays[uid]) {
                //create local
                engine.log('new birthday from dav')
                bDays[uid] = remoteBDays[uid];
              } else if(bDays[uid].count < 3 || bDays[uid][2] < card.rev) {
                //pull from dav
                engine.log('updated birthday from dav')
                bDays[uid] = remoteBDays[uid];
                hasUpdates = true;
              } else if(bDays[uid][2] > card.rev) {
                //push to dav
                engine.log('synced birthday to dav')
                card.fn = bDays[uid][0];
                card.bday = bDays[uid][1];
                card.rev = bDays[uid][2];
                card.validate();
                vcard.addressData = vCardToString(card);
                davClient.updateCard(cards[uid]);
              }
            }
          })
        }
        //create in dav
        for(const uid in bDays) {
          if(!remoteBDays[uid] && bDays[uid][1]) {
            engine.log('created birthday in dav')
            const card = new VCard({
              fn: bDays[uid][0], 
              bday: new Date(bDays[uid][1]), 
              rev: bDays[uid].length > 2 ? bDays[uid][2] : new Date(), 
              note: uid});
            card.validate();
            davClient.createCard(usedAddressBook, {
              data: vCardToString(card),
              filename: `${card.uid}.vcf`,
              xhr: xhr
            });
            remoteBDays[uid] = bDays[uid];
          }
        }
      })
    }
  });
});

function vCardToString(vCard) {
  return `BEGIN:VCARD
  VERSION:3.0
  UID:${vCard.uid}
  N:;${vCard.fn};;;
  FN:${vCard.fn}
  NOTE:${vCard.note && vCard.note[0] ? vCard.note[0] : ""}
  REV:${(vCard.rev instanceof Date ? vCard.rev.toISOString().replace(/[-:]|\.000/g, '') : vCard.rev)}
  BDAY;VALUE=date:${vCard.bday.toISOString().substring(0, 10).replace(/-/g, '')}
  PRODID:-//birthday-script//EN
  END:VCARD
  `;
  }