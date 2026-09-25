const WebSocket = require('ws');

async function runTests() {
  console.log('--- STARTING KURO SYNC COMPREHENSIVE VERIFICATION ---');

  // Test 1: Health / Static HTML
  const resHtml = await fetch('http://localhost:3000/');
  console.log('Test 1: Static HTML served -> Status:', resHtml.status);
  if (resHtml.status !== 200) throw new Error('Static HTML not 200');

  // Test 2: Register iPad Device
  const resReg = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)' },
    body: JSON.stringify({
      email: `taha_${Date.now()}@kurosync.com`,
      password: 'SecurePassword123!',
      name: 'Taha',
      deviceName: 'iPad Pro 12.9"'
    })
  });
  const regData = await resReg.json();
  console.log('Test 2: iPad registered ->', regData.user.name, '| Device:', regData.device.name);
  const ipadToken = regData.token;
  const ipadDeviceId = regData.device.id;

  // Test 3: Connect Laptop to same user account
  const resLogin = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    body: JSON.stringify({
      email: regData.user.email,
      password: 'SecurePassword123!',
      deviceName: 'Windows Laptop (ThinkPad)'
    })
  });
  const loginData = await resLogin.json();
  console.log('Test 3: Laptop connected to account -> Device:', loginData.device.name);
  const laptopToken = loginData.token;
  const laptopDeviceId = loginData.device.id;

  // Test 4: Realtime WebSocket Synchronization (iPad -> Laptop)
  console.log('Test 4: Setting up real-time WebSocket listeners...');
  const laptopWs = new WebSocket(`ws://localhost:3000/ws?token=${laptopToken}&deviceId=${laptopDeviceId}`);

  const receivedOnLaptopPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebSocket sync timeout!')), 5000);
    laptopWs.on('message', (msg) => {
      const parsed = JSON.parse(msg.toString());
      if (parsed.type === 'ITEM_CREATED') {
        clearTimeout(timeout);
        resolve(parsed.item);
      }
    });
  });

  await new Promise((r) => laptopWs.on('open', r));
  console.log('   Laptop WebSocket connected!');

  // iPad creates Text Item: "Operative Dentistry Notes"
  console.log('   iPad sending Text Item: "Cavity preparation principles"...');
  const resItem = await fetch('http://localhost:3000/api/items/text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ipadToken}`
    },
    body: JSON.stringify({
      title: 'Operative Dentistry Notes',
      content: 'Cavity preparation principles:\n1. Retention form\n2. Resistance form\n3. Convenience form',
      type: 'text'
    })
  });
  const itemData = await resItem.json();
  console.log('   iPad saved item ID:', itemData.item.id);

  // Await realtime event on Laptop
  const laptopReceivedItem = await receivedOnLaptopPromise;
  console.log('Test 4 SUCCESS: Real-time event arrived on Laptop without reload!');
  console.log('   Title:', laptopReceivedItem.title);
  console.log('   Source Device:', laptopReceivedItem.device_name);

  // Test 5: Device Pairing Flow (Laptop generates QR/Code, iPhone claims code)
  console.log('Test 5: Testing Device Pairing Flow...');
  const pairGenRes = await fetch('http://localhost:3000/api/auth/pairing/generate', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${laptopToken}` }
  });
  const pairGenData = await pairGenRes.json();
  console.log('   Pairing Code generated:', pairGenData.code);
  console.log('   QR Code generated:', pairGenData.qrDataUrl.slice(0, 35) + '...');

  // iPhone claims pairing code
  const pairClaimRes = await fetch('http://localhost:3000/api/auth/pairing/claim', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' 
    },
    body: JSON.stringify({
      code: pairGenData.code,
      deviceName: 'iPhone 15 Pro'
    })
  });
  const pairClaimData = await pairClaimRes.json();
  console.log('Test 5 SUCCESS: iPhone successfully claimed code without password!');
  console.log('   iPhone connected device:', pairClaimData.device.name);

  // Test 6: Devices Presence List
  const devicesRes = await fetch('http://localhost:3000/api/auth/devices', {
    headers: { 'Authorization': `Bearer ${laptopToken}` }
  });
  const devicesList = await devicesRes.json();
  console.log(`Test 6: Connected Devices count: ${devicesList.length}`);
  devicesList.forEach(d => console.log(`   - ${d.name} (${d.type}) [Online: ${d.is_online ? 'YES' : 'NO'}]`));

  // Test 7: Public Share Link
  const shareRes = await fetch('http://localhost:3000/api/shares', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${laptopToken}` 
    },
    body: JSON.stringify({
      item_id: itemData.item.id,
      expiry_hours: 24
    })
  });
  const shareData = await shareRes.json();
  console.log('Test 7: Secure Public Share URL generated:', shareData.shareUrl);

  const publicViewRes = await fetch(`http://localhost:3000/api/shares/${shareData.token}`);
  const publicViewData = await publicViewRes.json();
  console.log('   Public view retrieved item title:', publicViewData.title, '| Author:', publicViewData.author_name);

  // Close WS
  laptopWs.close();
  console.log('\n--- ALL KURO SYNC VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
