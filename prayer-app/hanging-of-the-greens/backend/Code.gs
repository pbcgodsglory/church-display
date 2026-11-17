/** Dedicated read-only project. Do NOT paste into the prayer-request project. */
const GREENS_SHEET_ID_ = '1-SbizKHUYtgFZz-L6CDAOy2ucwC7_Z4hAE3ewDVD9zk';
const GREENS_HEADERS_ = ['Order','Title','Reader','Reading','Stage Instructions'];

function greensRows_(values) {
  if (!values.length || GREENS_HEADERS_.some((h,i)=>values[0][i] !== h)) throw new Error('Invalid headers');
  const rows=values.slice(1).filter(r=>r.some(v=>String(v).trim() !== ''));
  if(rows.length !== 13) throw new Error('Expected 13 readings');
  const orders=new Set();
  return rows.map(r=>{
    const order=Number(r[0]);
    if(!Number.isInteger(order) || order<1 || order>13 || orders.has(order)) throw new Error('Invalid order');
    orders.add(order);
    if(!String(r[1]).trim() || !String(r[3]).trim()) throw new Error('Missing reading');
    return {order:order,title:String(r[1]),reader:String(r[2] || ''),reading:String(r[3]),stageInstructions:String(r[4] || '')};
  }).sort((a,b)=>a.order-b.order);
}

function doGet() {
  let result;
  try {
    // A fixed spreadsheet and tab, never a visitor-supplied ID or range.
    // The Sheets API supports spreadsheets.readonly; SpreadsheetApp.openById
    // requires a broader write scope even when used only for reading.
    const data=Sheets.Spreadsheets.Values.get(GREENS_SHEET_ID_, 'Readings!A1:E100',
      {valueRenderOption:'UNFORMATTED_VALUE'});
    result={ok:true,sections:greensRows_(data.values || [])};
  } catch(error) {
    console.error(error && error.stack || String(error));
    result={ok:false,error:'Readings are unavailable. Please contact the church.'};
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function doPost() {
  return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Read only'})).setMimeType(ContentService.MimeType.JSON);
}
