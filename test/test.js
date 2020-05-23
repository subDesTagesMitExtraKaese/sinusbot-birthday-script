var dav = require('dav');
var VCard = require( 'vcard' )
var VCF = require( 'vcf' )

var xhr = new dav.transport.Basic(
  new dav.Credentials({
    username: '',
    password: ''
  })
);


var client = new dav.Client(xhr);
// No transport arg
client.createAccount({
  server: 'https://example.com/dav.php',
  accountType: 'carddav'
})
.then(function(account) {
  account.addressBooks.forEach(function(addressBook) {
    console.log('Found address book name ' + addressBook.displayName);

    const card = new VCard({fn: 'name', bday: new Date()});
    card.validate();
    console.log(vCardToString(card))

    client.createCard(addressBook, {
      data: vCardToString(card),
      filename: `${card.uid}.vcf`,
      xhr: xhr
    })
    client.syncAddressBook(addressBook).then(function(x) {
      for(const vcard of x.objects) {
        console.log(vcard.addressData);
        VCF.parse(vcard.addressData, function(card) {
          console.log(card, vCardToString(card))
        })
      }
    })
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