const https = require('https');

const url = "https://fyikotexldhpjhirfevj.supabase.co/storage/v1/object/public/avatars/77bf78cd-351f-46da-931d-f84604c244fd/1766960733436.jpg?v=1766960733725";

https.get(url, (res) => {
  console.log('StatusCode:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
      data += chunk;
  });
  
  res.on('end', () => {
      console.log('Body length:', data.length);
  });

}).on('error', (e) => {
  console.error(e);
});
