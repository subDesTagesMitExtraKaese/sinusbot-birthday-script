
//edit webdav config
let config = {
  davUrl:         'https://example.com/dav.php',
  davUsername:    'username',
  davPassword:    'password',
  davAddressBook: ''
}
//and delete this line:
config = require('./secrets')
//or create secrets.js:
/*
  module.exports = {
    davUrl:         'https://example.com/dav.php',
    davUsername:    'username',
    davPassword:    'password',
    davAddressBook: ''
  }
 */


const WebSocket = require('ws');
var dav = require('dav');
var VCard = require('vcard');
var VCF = require('vcf');
 
const wss = new WebSocket.Server({
  port: 23845,
  perMessageDeflate: false
});


var xhr = new dav.transport.Basic(
  new dav.Credentials({
    username: config.davUsername,
    password: config.davPassword
  })
);

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
  console.log('Using ' + addressBook.displayName);
  usedAddressBook = addressBook;
});

wss.on('connection', function connection(ws) {
  console.log('new ws connection');
  ws.on('message', function incoming(message) {
    const bDays = JSON.parse(message);
    console.log('received: ', bDays);
    syncDavAddressBook(ws, bDays);
  });
  
});

var oldRemoteBDays = {};

function syncDavAddressBook(ws, bDays) {
  if(!usedAddressBook)
    return;
  
  davClient.syncAddressBook(usedAddressBook).then(function(x) {
    let remoteBDays = {};
    let hasUpdates = false;

    for(const vcard of x.objects) {
      VCF.parse(vcard.addressData, function(card) {
        if(!isNaN(card.bday) && card.note && card.note.length > 0) {
          const uid = card.note[0]
          remoteBDays[uid] = [card.fn, card.bday, card.rev];
          if(!bDays[uid] && !oldRemoteBDays[uid]) {
            //create local
            console.log('new birthday from dav')
            bDays[uid] = remoteBDays[uid];
            hasUpdates = true;
          } else if(bDays[uid].count < 3 || new Date(bDays[uid][2]) < card.rev) {
            //pull from dav
            console.log('updated birthday from dav')
            bDays[uid] = remoteBDays[uid];
            hasUpdates = true;
          } else if(new Date(bDays[uid][2]) > card.rev && !isNaN(card.rev)) {
            //push to dav
            console.log('synced birthday to dav')
            card.fn = bDays[uid][0];
            card.bday = new Date(bDays[uid][1]);
            card.rev = new Date(bDays[uid][2]);
            card.validate();
            vcard.addressData = vCardToString(card);
            davClient.updateCard(vcard);
          }
        }
      })
    }
    for(const uid in bDays) {
      if(!oldRemoteBDays[uid] && !remoteBDays[uid] && bDays[uid][1]) {
        //create in dav
        console.log('created birthday in dav')
        const card = new VCard({
          fn: bDays[uid][0], 
          bday: new Date(bDays[uid][1]), 
          rev: bDays[uid].length > 2 ? new Date(bDays[uid][2]) : new Date(), 
          note: uid});
        card.validate();
        davClient.createCard(usedAddressBook, {
          data: vCardToString(card),
          filename: `${card.uid}.vcf`,
          xhr: xhr
        });
        remoteBDays[uid] = bDays[uid];
      } else if(oldRemoteBDays[uid] && !remoteBDays[uid] && bDays[uid][1]) {
        // delete local
        delete bDays[uid];
        hasUpdates = true;
      }
    }
    oldRemoteBDays = remoteBDays;
    //send ws
    if(hasUpdates) {
      console.log('send: ', bDays);
      ws.send(JSON.stringify(bDays))
    }
  })
}

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