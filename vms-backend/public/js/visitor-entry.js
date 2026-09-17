let currentVisitor = null;
let cameraStream = null;
let capturedBlob = null;

(async function init() {
  const auth = requireRole('security', 'admin');
  if (!auth) return;

  renderShell({
    active: auth.user.role === 'admin' ? 'transaction' : 'visitor-entry',
    activeChild: 'transaction:visitor-entry',
    title: 'Visitor Entry',
    subtitle: 'Fetch the visitor by their token/inward number and record arrival details',
  });

  document.getElementById('verify-form').addEventListener('submit', onVerify);
})();

async function onVerify(e) {
  e.preventDefault();
  const btn = document.getElementById('verify-btn');
  const input = document.getElementById('inwardInput');
  const resultCard = document.getElementById('result-card');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Fetching…';
  resultCard.style.display = 'none';
  stopCamera();
  capturedBlob = null;

  try {
    const { visitor } = await api(`/security/verify/${encodeURIComponent(input.value.trim())}`);
    currentVisitor = visitor;
    renderResult(visitor);
  } catch (err) {
    resultCard.style.display = 'block';
    resultCard.innerHTML = `
      <div class="card-body">
        <div class="chip chip-Cancelled" style="margin-bottom:10px;">Not Found</div>
        <p>${err.message}</p>
      </div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Fetch';
  }
}

function row(label, value) {
  return `<div><div class="small text-muted" style="text-transform:uppercase;letter-spacing:.05em;">${label}</div><div style="margin-top:2px;">${value}</div></div>`;
}

function renderResult(v) {
  const resultCard = document.getElementById('result-card');
  resultCard.style.display = 'block';

  const infoBlock = `
    <div class="grid-2">
      ${row('Visitor', v.visitorName)}
      ${row('Mobile', v.mobile)}
      ${row('Email', v.email)}
      ${row('Category', v.visitorCategory?.categoryName || '—')}
      ${row('Company', v.visitorCompany || '—')}
      ${row('Person to Meet', v.personToMeet || '—')}
      ${row('Department', v.department?.departmentName || '—')}
      ${row('Plant / Location', [v.plant?.plantName, v.location?.locationName].filter(Boolean).join(' · ') || '—')}
      ${row('Appointment', fmtDateTime(v.appointmentDate))}
      ${row('Status', chip(v.status))}
    </div>
    <div class="mt-16"><b>Purpose:</b> <span class="text-muted">${v.purpose}</span></div>
  `;

  if (v.status === 'Pending' || v.status === 'Verified') {
    resultCard.innerHTML = `
      <div class="card-header"><h2>Appointment Found — ${v.inwardNumber}</h2></div>
      <div class="card-body">
        ${infoBlock}
        <div class="section-title">Arrival Details</div>
        <form id="checkin-form">
          <div class="grid-2" style="align-items:start;">
            <div>
              <div class="grid-3">
                <div class="field">
                  <label for="vehicleType">Vehicle Type</label>
                  <select id="vehicleType">
                    <option>None</option><option>Two Wheeler</option><option>Four Wheeler</option>
                    <option>Truck</option><option>Container</option><option>Other</option>
                  </select>
                </div>
                <div class="field">
                  <label for="vehicleNumber">Vehicle Number</label>
                  <input type="text" id="vehicleNumber" placeholder="e.g. MH-12-AB-1234" />
                </div>
                <div class="field">
                  <label for="materialCarried">Material / Luggage Carried</label>
                  <input type="text" id="materialCarried" placeholder="e.g. Laptop bag / None" />
                </div>
                <div class="field">
                  <label for="idProofType">ID Proof Type</label>
                  <select id="idProofType">
                    <option>Aadhaar</option><option>PAN</option><option>Driving License</option>
                    <option>Voter ID</option><option>Passport</option><option>Company ID</option><option>Other</option>
                  </select>
                </div>
                <div class="field">
                  <label for="idProofNumber">ID Proof Number</label>
                  <input type="text" id="idProofNumber" placeholder="ID number" />
                </div>
                <div class="field">
                  <label for="cardNumber">Assign Access Card <span class="hint">(optional)</span></label>
                  <input type="text" id="cardNumber" class="mono" placeholder="e.g. CARD001" />
                </div>
              </div>
              <div class="field">
                <label for="securityRemarks">Remarks <span class="hint">(optional)</span></label>
                <input type="text" id="securityRemarks" placeholder="Any additional notes" />
              </div>
            </div>

            <div>
              <div class="section-title" style="margin-top:0;">Visitor Photo</div>
              <div class="grid-2">
                <div>
                  <div class="small text-muted" style="margin-bottom:6px;">Live Camera</div>
                  <video id="camera-preview" autoplay playsinline muted style="width:100%;border-radius:8px;background:#000;aspect-ratio:4/3;object-fit:cover;"></video>
                  <canvas id="camera-canvas" style="display:none;"></canvas>
                  <div class="flex gap-8 mt-8">
                    <button type="button" class="btn btn-secondary" id="camera-start-btn">Start Camera</button>
                    <button type="button" class="btn btn-primary" id="camera-capture-btn" disabled>Capture</button>
                  </div>
                </div>
                <div>
                  <div class="small text-muted" style="margin-bottom:6px;">Captured Image</div>
                  <img id="captured-preview" style="display:none;width:100%;border-radius:8px;aspect-ratio:4/3;object-fit:cover;background:var(--surface-2);" />
                  <div class="field mt-8" style="margin-bottom:0;">
                    <label for="photo" class="small">Or upload a photo instead</label>
                    <input type="file" id="photo" accept="image/*" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button type="submit" class="btn btn-primary mt-16" id="checkin-btn">Save &amp; Check In</button>
        </form>
      </div>
    `;
    document.getElementById('checkin-form').addEventListener('submit', onCheckIn);
    document.getElementById('camera-start-btn').addEventListener('click', startCamera);
    document.getElementById('camera-capture-btn').addEventListener('click', captureFromCamera);
    document.getElementById('photo').addEventListener('change', () => { capturedBlob = null; showCapturedPreview(null); });
  } else if (v.status === 'CheckedIn') {
    resultCard.innerHTML = `
      <div class="card-header"><h2>Already Checked In — ${v.inwardNumber}</h2></div>
      <div class="card-body">
        ${infoBlock}
        <div class="grid-2 mt-16">
          ${row('Vehicle', v.vehicleType !== 'None' ? `${v.vehicleType} · ${v.vehicleNumber || '—'}` : 'None')}
          ${row('Entry Time', fmtDateTime(v.entryTime))}
          ${row('Access Card', v.assignedCard?.cardNumber || 'Not assigned')}
        </div>
        <p class="small text-muted mt-16">This visitor is already checked in. Use <b>Out Pending List</b> to record their exit.</p>
        <button class="btn btn-secondary mt-8" id="gatepass-btn">Generate / Download Gate Pass Receipt</button>
        <div id="gatepass-link" class="small mt-16"></div>
      </div>
    `;
    document.getElementById('gatepass-btn').addEventListener('click', onGeneratePass);
  } else {
    resultCard.innerHTML = `
      <div class="card-header"><h2>${v.inwardNumber}</h2></div>
      <div class="card-body">${infoBlock}<div class="mt-16">${chip(v.status)}</div></div>
    `;
  }
}

/* ---------------- Camera capture ---------------- */
async function startCamera() {
  const video = document.getElementById('camera-preview');
  const startBtn = document.getElementById('camera-start-btn');
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    video.srcObject = cameraStream;
    startBtn.textContent = 'Camera On';
    startBtn.disabled = true;
    document.getElementById('camera-capture-btn').disabled = false;
  } catch (err) {
    toast(`Could not access camera: ${err.message}`, 'error');
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
}

function captureFromCamera() {
  const video = document.getElementById('camera-preview');
  const canvas = document.getElementById('camera-canvas');
  canvas.width = video.videoWidth || 480;
  canvas.height = video.videoHeight || 360;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => {
    capturedBlob = blob;
    showCapturedPreview(URL.createObjectURL(blob));
    document.getElementById('photo').value = '';
  }, 'image/jpeg', 0.9);
}

function showCapturedPreview(url) {
  const img = document.getElementById('captured-preview');
  if (!img) return;
  if (url) {
    img.src = url;
    img.style.display = 'block';
  } else {
    img.style.display = 'none';
  }
}

/* ---------------- Check-in submit ---------------- */
async function onCheckIn(e) {
  e.preventDefault();
  const btn = document.getElementById('checkin-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Checking in…';

  const formData = new FormData();
  formData.append('vehicleType', document.getElementById('vehicleType').value);
  formData.append('vehicleNumber', document.getElementById('vehicleNumber').value);
  formData.append('materialCarried', document.getElementById('materialCarried').value);
  formData.append('idProofType', document.getElementById('idProofType').value);
  formData.append('idProofNumber', document.getElementById('idProofNumber').value);
  formData.append('securityRemarks', document.getElementById('securityRemarks').value);
  const cardNumberVal = document.getElementById('cardNumber').value.trim();
  if (cardNumberVal) formData.append('cardNumber', cardNumberVal);

  const uploadedFile = document.getElementById('photo').files[0];
  if (capturedBlob) {
    formData.append('photo', capturedBlob, 'captured.jpg');
  } else if (uploadedFile) {
    formData.append('photo', uploadedFile);
  }

  try {
    const { visitor } = await api(`/security/checkin/${encodeURIComponent(currentVisitor.inwardNumber)}`, {
      method: 'PUT',
      body: formData,
      isForm: true,
    });
    currentVisitor = visitor;
    stopCamera();
    toast('Visitor checked in', 'success');
    renderResult(visitor);
    // Immediately prepare the gate pass receipt for the security guard to hand over.
    onGeneratePassAuto();
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Save & Check In';
  }
}

async function onGeneratePassAuto() {
  try {
    const { gatePass } = await api(`/gatepass/generate/${encodeURIComponent(currentVisitor.inwardNumber)}`, { method: 'POST' });
    const linkMount = document.getElementById('gatepass-link');
    if (linkMount) {
      linkMount.innerHTML = `Gate pass receipt <b class="mono">${gatePass.gatePassNumber}</b> ready — <a class="link-btn" style="display:inline;color:var(--info);text-decoration:underline;" href="${gatePass.downloadUrl}?token=${encodeURIComponent(Auth.token())}" target="_blank">Download / Print Receipt</a>`;
    }
    toast(`Gate pass receipt ${gatePass.gatePassNumber} generated`, 'success');
  } catch (err) {
    toast(`Check-in succeeded, but the gate pass could not be generated automatically: ${err.message}`, 'error');
  }
}

async function onGeneratePass() {
  const btn = document.getElementById('gatepass-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Preparing…';
  try {
    const { gatePass } = await api(`/gatepass/generate/${encodeURIComponent(currentVisitor.inwardNumber)}`, { method: 'POST' });
    document.getElementById('gatepass-link').innerHTML =
      `Gate pass <b class="mono">${gatePass.gatePassNumber}</b> ready — <a class="link-btn" style="display:inline;color:var(--info);text-decoration:underline;" href="${gatePass.downloadUrl}?token=${encodeURIComponent(Auth.token())}" target="_blank">Download PDF</a>`;
    toast('Gate pass generated', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate / Download Gate Pass Receipt';
  }
}
