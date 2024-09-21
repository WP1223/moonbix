function displayHeader() {
  process.stdout.write('\x1Bc');
  console.log('========================================'.cyan);
  console.log('= 🐒🐒🐒 Moonbix Airdrop Bot 🐒🐒🐒 ='.cyan);
  console.log('=     Created by Dân Cày Airdrop       ='.cyan);
  console.log('=        EVOS GALANG RAAAWR!!!!        ='.cyan);
  console.log('========================================'.cyan);
  console.log();
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
  displayHeader,
  delay,
};