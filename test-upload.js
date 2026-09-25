const fs = require('fs');
const path = require('path');

async function testFileUploadAndStorage() {
  console.log('--- TESTING FILE UPLOAD & DUPLICATE DETECTION ---');

  // 1. Create a dummy test PDF file
  const testPdfPath = path.join(__dirname, 'Pathology_Sample.pdf');
  fs.writeFileSync(testPdfPath, '%PDF-1.4\n1 0 obj\n<< /Title (Dental Pathology) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');

  // Login
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'taha_test@kurosync.com',
      password: 'Password123!',
      deviceName: 'iPad Pro'
    })
  });
  let token;
  if (!loginRes.ok) {
    const regRes = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'taha_test@kurosync.com',
        password: 'Password123!',
        name: 'Dr. Taha',
        deviceName: 'iPad Pro'
      })
    });
    const reg = await regRes.json();
    token = reg.token;
  } else {
    const log = await loginRes.json();
    token = log.token;
  }

  // Upload PDF using FormData
  const fileBytes = fs.readFileSync(testPdfPath);
  const blob = new Blob([fileBytes], { type: 'application/pdf' });
  const form = new FormData();
  form.append('file', blob, 'Pathology_Sample.pdf');

  const uploadRes = await fetch('http://localhost:3000/api/items/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });

  const uploadData = await uploadRes.json();
  console.log('File upload result:', uploadData.success ? 'SUCCESS' : 'FAILED', '| Item ID:', uploadData.item.id);
  console.log('   File name:', uploadData.item.file_name, '| Size:', uploadData.item.file_size, 'bytes');

  // Test duplicate detection by uploading the exact same file again
  console.log('Testing duplicate detection...');
  const form2 = new FormData();
  form2.append('file', blob, 'Pathology_Sample.pdf');

  const dupRes = await fetch('http://localhost:3000/api/items/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form2
  });

  const dupData = await dupRes.json();
  console.log('Duplicate test result -> status:', dupRes.status, '| Duplicate detected:', dupData.duplicate === true ? 'YES' : 'NO');

  // Test download preserving filename
  const dlRes = await fetch(`http://localhost:3000/api/items/${uploadData.item.id}/file?download=1`);
  const contentDisp = dlRes.headers.get('content-disposition');
  console.log('Content-Disposition header:', contentDisp);

  // Clean up test file
  fs.unlinkSync(testPdfPath);
  console.log('--- FILE UPLOAD & DUPLICATE TESTS COMPLETED! ---');
}

testFileUploadAndStorage().catch(console.error);
