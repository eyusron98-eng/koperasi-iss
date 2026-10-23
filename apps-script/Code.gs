// =============================================
// KOPERASI ISS - SISTEM MANAJEMEN BAHAN DAPUR
// Google Apps Script Backend (Code.gs)
// =============================================

function response(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function getSheet(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }

function fmtDate_(d) {   // JS murni — tanpa panggilan Utilities (jauh lebih cepat)
  const y = d.getFullYear(), m = d.getMonth() + 1, dd = d.getDate();
  return y + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
}
function sheetToObjects(sheet) {
  if (!sheet || sheet.getLastRow() <= 1) return [];
  const data = sheet.getDataRange().getValues(), headers = data[0], out = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    let empty = true;
    for (let c = 0; c < row.length; c++) { const v = row[c]; if (v !== '' && v !== null && v !== undefined) { empty = false; break; } }
    if (empty) continue;
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      let val = row[c];
      if (val instanceof Date) val = fmtDate_(val);
      obj[headers[c]] = val === '' ? '' : val;
    }
    out.push(obj);
  }
  return out;
}

function findRowIndex(sheet, colName, value) {
  const data = sheet.getDataRange().getValues(), headers = data[0], ci = headers.indexOf(colName);
  for (let i = 1; i < data.length; i++) { if (String(data[i][ci]) === String(value)) return i + 1; }
  return -1;
}

function updateCell(sheet, rowNum, colName, value) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const ci = headers.indexOf(colName) + 1;
  if (ci > 0) sheet.getRange(rowNum, ci).setValue(value);
}

function inisialisasi() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = {
    orders:     ['id','dapur_id','tanggal_order','tanggal_kirim','status','created_at'],
    order_items:['id','order_id','nama_bahan','qty','satuan','harga_jual','harga_beli'],
    tugas_beli: ['id','tanggal','staf_id','nama_bahan','qty','satuan','harga_beli','status'],
    pengiriman: ['id','order_id','dapur_id','tanggal','status','foto_ceklis','foto_penerima','catatan'],
    kerugian:   ['id','tanggal','nama_bahan','qty','satuan','biaya','keterangan','created_at'],
    users:      ['id','username','password','role','name'],
  };
  for (const [name, headers] of Object.entries(config)) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  }
  // Migrate pengiriman if old format
  const ps = ss.getSheetByName('pengiriman');
  if (ps && ps.getLastRow() >= 1) {
    const h = ps.getRange(1,1,1,ps.getLastColumn()).getValues()[0];
    if (h.indexOf('foto_ceklis') === -1 && h.indexOf('foto_url') >= 0) {
      const fi = h.indexOf('foto_url');
      ps.getRange(1, fi+1).setValue('foto_ceklis');
      ps.insertColumnAfter(fi+1);
      ps.getRange(1, fi+2).setValue('foto_penerima');
    }
  }
  const usersSheet = ss.getSheetByName('users');
  if (usersSheet.getLastRow() <= 1) {
    [['u1','admin','admin123','admin','Admin Koperasi'],
     ['u2','op1','1234','operator','Operator 1'],
     ['u5','kosim','1234','staf_kirim','Kosim'],
     ['u6','ceo','ceo123','ceo','Direktur'],
     ['u7','sek','1234','sekretaris','Sekretaris']
    ].forEach(u => usersSheet.appendRow(u));
  }
  return 'Inisialisasi berhasil!';
}

function bersihkanBarisKosong() {
  const sheet = getSheet('tugas_beli');
  if (!sheet) return 'Sheet tidak ditemukan';
  const data = sheet.getDataRange().getValues();
  let del = 0;
  for (let i = data.length - 1; i >= 1; i--) {
    if (!data[i][0] && !data[i][1] && !data[i][3]) { sheet.deleteRow(i + 1); del++; }
  }
  return 'Berhasil menghapus ' + del + ' baris kosong';
}

// =============================================
// GET HANDLER
// =============================================
// ============ HELPER BATCH (cepat) ============
// Tulis banyak baris sekaligus — 1 operasi, bukan 1 per baris
function appendRows_(sheet, rows) {
  if (!rows || !rows.length) return;
  const start = sheet.getLastRow() + 1;
  sheet.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
}
// Update banyak sel sekaligus lewat 1 baca + 1 tulis per kolom blok
function patchItems_(sheet, items) {
  if (!items || !items.length) return;
  const last = sheet.getLastRow(); if (last < 2) return;
  const H = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  const iId = H.indexOf('id'), iQty = H.indexOf('qty'), iHj = H.indexOf('harga_jual'), iHb = H.indexOf('harga_beli');
  if (iId < 0) return;
  // kolom qty..harga_beli bersebelahan -> cukup tulis blok sempit
  const c0 = Math.min(iQty, iHj, iHb), c1 = Math.max(iQty, iHj, iHb);
  const ids = sheet.getRange(2, iId+1, last-1, 1).getValues();
  const pos = {};
  for (let i = 0; i < ids.length; i++) pos[String(ids[i][0])] = i + 2;   // nomor baris asli
  let minR = Infinity, maxR = -Infinity;
  const want = {};
  items.forEach(it => {
    const r = pos[String(it.id)];
    if (r === undefined) return;
    want[r] = it; if (r < minR) minR = r; if (r > maxR) maxR = r;
  });
  if (maxR < 0) return;
  const rng = sheet.getRange(minR, c0+1, maxR-minR+1, c1-c0+1);
  const blk = rng.getValues();
  let changed = false;
  for (const rs in want) {
    const r = Number(rs), it = want[r], row = blk[r-minR];
    if (it.qty        !== undefined) { row[iQty-c0] = it.qty;        changed = true; }
    if (it.harga_jual !== undefined) { row[iHj-c0] = it.harga_jual; changed = true; }
    if (it.harga_beli !== undefined) { row[iHb-c0] = it.harga_beli; changed = true; }
  }
  if (changed) rng.setValues(blk);
}

// ============ CACHE SERVER ============
// Cache dihapus setiap ada penulisan lewat aplikasi (clearCache_), jadi TTL panjang aman.
// Konsekuensi: kalau sheet diedit LANGSUNG di Google Sheets, perubahan baru tampak
// di aplikasi setelah cache habis (maks. CACHE_TTL_ detik).
const CACHE_TTL_ = 600;         // detik
const CHUNK_ = 80000;           // batas aman per entri cache (maks 100 KB)
const CACHE_MAX_CHUNK_ = 25;    // lebih besar dari ini -> lewati cache

// Versi cache: clearCache_ cukup mengganti versi, semua entri lama otomatis tak terpakai
function cacheVer_() {
  try {
    const c = CacheService.getScriptCache();
    let v = c.get('VER');
    if (!v) { v = String(Date.now()); c.put('VER', v, 21600); }
    return v;
  } catch (e) { return '0'; }
}
function cachePut_(name, json) {
  try {
    const n = Math.ceil(json.length / CHUNK_);
    if (n > CACHE_MAX_CHUNK_) return;
    const base = 'C' + cacheVer_() + '_' + name;
    const map = {};
    for (let i = 0; i < n; i++) map[base + '_' + i] = json.substr(i * CHUNK_, CHUNK_);
    map[base + '_N'] = String(n);
    CacheService.getScriptCache().putAll(map, CACHE_TTL_);
  } catch (e) {}
}
function cacheGet_(name) {
  try {
    const c = CacheService.getScriptCache();
    const base = 'C' + cacheVer_() + '_' + name;
    const n = Number(c.get(base + '_N'));
    if (!n) return null;
    const keys = [];
    for (let i = 0; i < n; i++) keys.push(base + '_' + i);
    const got = c.getAll(keys);
    let out = '';
    for (let i = 0; i < n; i++) { const p = got[base + '_' + i]; if (p === undefined || p === null) return null; out += p; }
    return out;
  } catch (e) { return null; }
}
function clearCache_() {
  try { CacheService.getScriptCache().put('VER', String(Date.now()), 21600); } catch (e) {}
}

// ============ FILTER TANGGAL ============
const TGL_RE_ = /^\d{4}-\d{2}-\d{2}$/;
function tgl_(v) { return String(v === null || v === undefined ? '' : v).slice(0, 10); }
// Format tanggal tak dikenal SENGAJA ikut terkirim, supaya tidak ada data hilang diam-diam
function sejak_(v, dari) { const t = tgl_(v); return !TGL_RE_.test(t) || t >= dari; }
function antara_(v, dari, sampai) { const t = tgl_(v); return !TGL_RE_.test(t) || (t >= dari && t <= sampai); }
const STATUS_AKTIF_ = { draft: 1, pending_approval: 1, pending_kirim: 1 };   // belum selesai -> selalu ikut

function filterAll_(p, dari) {
  const orders = p.orders.filter(o => STATUS_AKTIF_[o.status] || sejak_(o.tanggal_kirim, dari));
  const idOrder = {};
  orders.forEach(o => { idOrder[String(o.id)] = 1; });
  return {
    orders: orders,
    tugas: p.tugas.filter(t => sejak_(t.tanggal, dari)),
    pengiriman: p.pengiriman.filter(x => idOrder[String(x.order_id)] || sejak_(x.tanggal, dari)),
    users: p.users,
    kerugian: p.kerugian.filter(k => sejak_(k.tanggal, dari)),
  };
}
function userPublik_(u) { return { id: u.id, username: u.username, role: u.role, name: u.name }; }   // tanpa password
function kerugianList_() {
  const ks = getSheet('kerugian');
  return ks ? sheetToObjects(ks).map(k=>({...k, qty:parseFloat(k.qty)||0, biaya:parseFloat(k.biaya)||0})) : [];
}

// Bangun daftar order + item dengan index (cepat, O(n))
function buildOrders_() {
  const orders = sheetToObjects(getSheet('orders'));
  const items  = sheetToObjects(getSheet('order_items'));
  const byOrder = {};
  items.forEach(it => {
    const k = String(it.order_id);
    (byOrder[k] = byOrder[k] || []).push({
      ...it, nama: it.nama_bahan||it.nama||'',
      qty: parseFloat(it.qty)||0, harga_jual: parseFloat(it.harga_jual)||0, harga_beli: parseFloat(it.harga_beli)||0,
    });
  });
  return orders.map(o => ({ ...o, items: byOrder[String(o.id)] || [] }));
}

function doGet(e) {
  const action = e.parameter.action;
  try {
    switch (action) {
      case 'login': {
        const { username, password } = e.parameter;
        const users = sheetToObjects(getSheet('users'));
        const user = users.find(u => String(u.username).trim()===String(username).trim() && String(u.password).trim()===String(password).trim());
        if (user) return response({success:true, user:{u:user.username, name:user.name, role:user.role}});
        return response({success:false, message:'Username atau password salah'});
      }
      case 'getUsers':
        return response(sheetToObjects(getSheet('users')).map(userPublik_));
      case 'getOrders':
        return response(buildOrders_());
      case 'getTugasBeli':
        return response(sheetToObjects(getSheet('tugas_beli')).map(t=>({...t, qty:parseFloat(t.qty)||0, harga_beli:parseFloat(t.harga_beli)||0})));
      case 'getPengiriman':
        return response(sheetToObjects(getSheet('pengiriman')));
      case 'getKerugian':
        return response(kerugianList_());
      // Data harian aplikasi. Parameter opsional: dari=YYYY-MM-DD -> hanya data sejak tanggal itu
      // (plus order yang belum selesai). Tanpa parameter -> semua data (perilaku lama).
      case 'getAll': {
        const dari = TGL_RE_.test(String(e.parameter.dari || '')) ? e.parameter.dari : '';
        const ck = 'all_' + (dari || 'semua');
        const cached = cacheGet_(ck);
        if (cached) return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
        let payload = {
          orders: buildOrders_(),
          tugas: sheetToObjects(getSheet('tugas_beli')).map(t=>({...t, qty:parseFloat(t.qty)||0, harga_beli:parseFloat(t.harga_beli)||0})),
          pengiriman: sheetToObjects(getSheet('pengiriman')),
          users: sheetToObjects(getSheet('users')).map(userPublik_),
          kerugian: kerugianList_()
        };
        if (dari) payload = filterAll_(payload, dari);
        const json = JSON.stringify(payload);
        cachePut_(ck, json);
        return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
      }
      // Halaman Laporan: order + pengeluaran pada rentang tanggal (dari & sampai wajib, YYYY-MM-DD)
      case 'getLaporan': {
        const dari = String(e.parameter.dari || ''), sampai = String(e.parameter.sampai || '');
        if (!TGL_RE_.test(dari) || !TGL_RE_.test(sampai)) return response({error:'Parameter dari dan sampai harus berformat YYYY-MM-DD'});
        const ck = 'lap_' + dari + '_' + sampai;
        const cached = cacheGet_(ck);
        if (cached) return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
        const json = JSON.stringify({
          orders: buildOrders_().filter(o => antara_(o.tanggal_kirim, dari, sampai)),
          kerugian: kerugianList_().filter(k => antara_(k.tanggal, dari, sampai))
        });
        cachePut_(ck, json);
        return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
      }
      case 'init': return response({message: inisialisasi()});
      default: return response({error:'Action tidak dikenal: '+action});
    }
  } catch(err) { return response({error:err.toString()}); }
}

// =============================================
// POST HANDLER
// =============================================
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const { action } = data;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
  } catch (lockErr) {
    return response({success:false, error:'Sedang ada penyimpanan lain. Coba lagi sebentar.'});
  }
  try {
    switch (action) {
      case 'addUser': {
        const {user} = data;
        const sheet = getSheet('users');
        if (sheetToObjects(sheet).find(u=>u.username===user.username)) return response({success:false,error:'Username sudah dipakai'});
        sheet.appendRow([user.id, user.username, user.password, user.role, user.name]);
        clearCache_(); return response({success:true});
      }
      case 'deleteUser': {
        const sheet = getSheet('users');
        const r = findRowIndex(sheet,'id',data.userId);
        if (r>0) sheet.deleteRow(r);
        clearCache_(); return response({success:true});
      }
      case 'addOrder': {
        const {order} = data;
        const os = getSheet('orders'), is = getSheet('order_items');
        os.appendRow([order.id, order.dapur_id, order.tanggal_order, order.tanggal_kirim, order.status, new Date().toISOString()]);
        appendRows_(is, order.items.map((item,idx) =>
          ['item-'+order.id+'-'+idx, order.id, item.nama, item.qty, item.satuan, item.harga_jual, item.harga_beli||0]));
        getSheet('pengiriman').appendRow(['pngrm-'+order.id, order.id, order.dapur_id, order.tanggal_kirim, 'pending', '', '', '']);
        clearCache_();
        return response({success:true});
      }
      case 'updateOrderStatus': {
        const sheet = getSheet('orders');
        const r = findRowIndex(sheet,'id',data.orderId);
        if (r>0) updateCell(sheet,r,'status',data.status);
        clearCache_(); return response({success:true});
      }

      // ---- DELETE ORDER (admin only — removes order, items, pengiriman) ----
      case 'deleteOrder': {
        const {orderId} = data;
        // Delete order
        const os = getSheet('orders');
        const or2 = findRowIndex(os,'id',orderId);
        if (or2>0) os.deleteRow(or2);
        // Delete order items
        const is = getSheet('order_items');
        const iData = is.getDataRange().getValues();
        if (iData.length > 1) {
          const oiIdx = iData[0].indexOf('order_id');
          const keepI = iData.filter((row,i) => i===0 || String(row[oiIdx])!==String(orderId));
          if (keepI.length !== iData.length) {
            is.getRange(1,1,iData.length,iData[0].length).clearContent();
            is.getRange(1,1,keepI.length,keepI[0].length).setValues(keepI);
          }
        }
        // Delete pengiriman
        const ps = getSheet('pengiriman');
        const pr = findRowIndex(ps,'id','pngrm-'+orderId);
        if (pr>0) ps.deleteRow(pr);
        clearCache_(); return response({success:true});
      }

      // ---- UPDATE HARGA JUAL per item (admin/operator) ----
      case 'updateHargaJual': {
        const {itemId, hargaJual} = data;
        const sheet = getSheet('order_items');
        const r = findRowIndex(sheet,'id',itemId);
        if (r>0) updateCell(sheet,r,'harga_jual',hargaJual);
        clearCache_(); return response({success:true});
      }

      // ---- BATCH UPDATE order items (for approval editing) ----
      case 'updateOrderItems': {
        const {items} = data;
        const sheet = getSheet('order_items');
        patchItems_(sheet, items);
        clearCache_();
        return response({success:true});
      }

      // ---- SUBMIT FOR APPROVAL (operator → admin) ----
      case 'submitForApproval': {
        const {orderId} = data;
        const sheet = getSheet('orders');
        const r = findRowIndex(sheet,'id',orderId);
        if (r>0) updateCell(sheet,r,'status','pending_approval');
        clearCache_(); return response({success:true});
      }

      // ---- APPROVE ORDER (admin) ----
      case 'approveOrder': {
        const {orderId, items} = data;
        // Update items if provided (admin edits)
        if (items && items.length > 0) {
          patchItems_(getSheet('order_items'), items);
        }
        const sheet = getSheet('orders');
        const r = findRowIndex(sheet,'id',orderId);
        if (r>0) updateCell(sheet,r,'status','approved');
        clearCache_();
        return response({success:true});
      }

      // ---- REJECT ORDER (admin) ----
      case 'rejectOrder': {
        const {orderId} = data;
        const sheet = getSheet('orders');
        const r = findRowIndex(sheet,'id',orderId);
        if (r>0) updateCell(sheet,r,'status','rejected');
        clearCache_(); return response({success:true});
      }

      case 'saveTugasBeli': {
        const {tugas, tanggal} = data;
        const sheet = getSheet('tugas_beli');
        const tgt = String(tanggal).trim().slice(0,10);
        const all = sheet.getDataRange().getValues();
        if (all.length > 1) {
          const di = all[0].indexOf('tanggal');
          // satu kali tulis ulang: buang baris tanggal ini + baris kosong
          const keep = [all[0]];
          for (let i = 1; i < all.length; i++) {
            const row = all[i];
            if (!row[0] && !row[1] && !row[3]) continue;        // baris kosong
            let cd = row[di];
            if (cd instanceof Date) cd = fmtDate_(cd);
            else cd = String(cd).trim().slice(0,10);
            if (cd === tgt) continue;                            // tanggal yang ditimpa
            keep.push(row);
          }
          if (keep.length !== all.length) {
            sheet.getRange(1,1,all.length,all[0].length).clearContent();
            sheet.getRange(1,1,keep.length,keep[0].length).setValues(keep);
          }
        }
        appendRows_(sheet, tugas.map(t => [t.id,t.tanggal,t.staf_id,t.nama_bahan,t.qty,t.satuan,0,'pending']));
        clearCache_();
        return response({success:true, count:tugas.length});
      }
      case 'updateHargaBeli': {
        const {tugasId, hargaBeli} = data;
        const ts = getSheet('tugas_beli');
        const tr = findRowIndex(ts,'id',tugasId);
        if (tr>0) { updateCell(ts,tr,'harga_beli',hargaBeli); updateCell(ts,tr,'status','done'); }
        const is = getSheet('order_items');
        const td = ts.getDataRange().getValues(), th = td[0];
        const nb = tr>0 ? td[tr-1][th.indexOf('nama_bahan')] : null;
        if (nb) {
          const iLast = is.getLastRow();
          if (iLast > 1) {
            const ih = is.getRange(1,1,1,is.getLastColumn()).getValues()[0];
            const ni = ih.indexOf('nama_bahan'), hi = ih.indexOf('harga_beli');
            const names = is.getRange(2, ni+1, iLast-1, 1).getValues();
            const hbCol = is.getRange(2, hi+1, iLast-1, 1);
            const hbVal = hbCol.getValues();
            let hbChanged = false;
            for (let i=0;i<names.length;i++) {
              if (names[i][0]===nb && (!hbVal[i][0] || hbVal[i][0]===0)) { hbVal[i][0]=hargaBeli; hbChanged=true; }
            }
            if (hbChanged) hbCol.setValues(hbVal);   // 1 kolom saja
          }
        }
        clearCache_(); return response({success:true});
      }
      case 'updateTugasStatus': {
        const sheet = getSheet('tugas_beli');
        const r = findRowIndex(sheet,'id',data.tugasId);
        if (r>0) updateCell(sheet,r,'status',data.status);
        clearCache_(); return response({success:true});
      }
      case 'updatePengiriman': {
        const {pengirimanId, status, catatan, foto_ceklis, foto_penerima} = data;
        const sheet = getSheet('pengiriman');
        const r = findRowIndex(sheet,'id',pengirimanId);
        if (r>0) {
          updateCell(sheet,r,'status',status);
          updateCell(sheet,r,'catatan',catatan||'');
          if (foto_ceklis) updateCell(sheet,r,'foto_ceklis',foto_ceklis);
          if (foto_penerima) updateCell(sheet,r,'foto_penerima',foto_penerima);
        }
        if (status==='delivered') {
          const pd=sheet.getDataRange().getValues(), ph=pd[0];
          const oid = pd[r-1][ph.indexOf('order_id')];
          if (oid) { const os=getSheet('orders'), or2=findRowIndex(os,'id',oid); if(or2>0) updateCell(os,or2,'status','delivered'); }
        }
        clearCache_(); return response({success:true});
      }
      case 'addKerugian': {
        const {item} = data;
        let s = getSheet('kerugian');
        if (!s) { s = SpreadsheetApp.getActiveSpreadsheet().insertSheet('kerugian'); s.appendRow(['id','tanggal','nama_bahan','qty','satuan','biaya','keterangan','created_at']); }
        s.appendRow([item.id, item.tanggal, item.nama_bahan, item.qty, item.satuan, item.biaya, item.keterangan, new Date().toISOString()]);
        clearCache_(); return response({success:true});
      }
      case 'deleteKerugian': {
        const s = getSheet('kerugian');
        if (s) { const r=findRowIndex(s,'id',data.kerugianId); if(r>0) s.deleteRow(r); }
        clearCache_(); return response({success:true});
      }
      default: return response({error:'Action tidak dikenal: '+action});
    }
  } catch(err) {
    return response({success:false, error:err.toString()});
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}
