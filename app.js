const API_URL = "https://script.google.com/macros/s/AKfycbzbWsZdZgEaced5kyta3B3lx9OZl--ghM9N5wph7fXTFJW4GhyvWu1vA3c7Jhuao36-/exec"; 
let html5QrCode;

// Cargar supervisores al iniciar y agregar opción "Otro"
window.onload = function() {
    fetch(API_URL) 
        .then(response => response.json())
        .then(res => {
            const select = document.getElementById('inputSupervisor');
            select.innerHTML = '<option value="">Seleccione...</option>';
            if(res.status === 'success' && res.data) {
                res.data.forEach(nombre => {
                    const option = document.createElement('option');
                    option.value = nombre;
                    option.innerText = nombre;
                    select.appendChild(option);
                });
                // Opción manual agregada
                const optionOtro = document.createElement('option');
                optionOtro.value = "Otro";
                optionOtro.innerText = "Otro (Ingresar manual)";
                select.appendChild(optionOtro);
            } else {
                select.innerHTML = '<option value="">Error cargando lista</option>';
            }
        })
        .catch(err => {
            console.error(err);
            document.getElementById('inputSupervisor').innerHTML = '<option value="">Error de conexión</option>';
        });
};

// Función para mostrar/ocultar input manual
function verificarOtro(selectElement) {
    const inputOtro = document.getElementById('inputOtroValidador');
    if (selectElement.value === 'Otro') {
        inputOtro.style.display = 'block';
        inputOtro.focus();
    } else {
        inputOtro.style.display = 'none';
        inputOtro.value = ''; 
    }
}

function sincronizarOP(valor) {
    document.getElementById('inputOP').value = valor;
    document.getElementById('inputOP_Confirm').value = valor;
}

function actualizarInterfazBobinas() {
    const cant = parseInt(document.getElementById('cantBobinas').value);
    const contenedor = document.getElementById('contenedorBobinas');
    contenedor.innerHTML = '';
    for (let i = 1; i <= cant; i++) {
        contenedor.innerHTML += `
            <div class="bobina-row" style="margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
                <p><b>Bobina ${i}</b></p>
                <button class="btn-scan" onclick="startScan('fisico', ${i})">📷 Escanear QR</button>
                <input type="number" id="metros-${i}" placeholder="Metros totales" style="margin-top:5px">
                
                <input type="hidden" id="valFisico-${i}">
                <input type="hidden" id="loteFisico-${i}">
                <input type="hidden" id="provFisico-${i}">
                
                <div class="badge" id="statusFisico-${i}">Pendiente</div>
            </div>`;
    }
}

function extraerInfoQR(texto) {
    const lineas = texto.split('\n');
    let mp = texto.trim(); 
    let lote = "S/I";
    let prov = "S/I";
    
    let formatoEncontrado = false;

    for (let linea of lineas) {
        const upper = linea.toUpperCase();
        
        if (upper.includes("MATERIA PRIMA:")) {
            mp = linea.split(':')[1].trim().toUpperCase();
            formatoEncontrado = true;
        }
        if (upper.includes("LOTE:")) {
            lote = linea.split(':')[1].trim().toUpperCase();
        }
        if (upper.includes("PROVEEDOR:")) {
            prov = linea.split(':')[1].trim().toUpperCase();
        }
    }

    if (!formatoEncontrado) {
        return { mp: texto.trim().toUpperCase(), lote: "", prov: "" };
    }

    return { mp, lote, prov };
}

function startScan(mode, idx = null) {
    const container = document.getElementById('reader-container');
    container.classList.remove('hidden');
    if (html5QrCode) html5QrCode.clear();
    html5QrCode = new Html5Qrcode("reader");
    
    html5QrCode.start({ facingMode: "environment" }, { fps: 15, qrbox: 250 }, (decodedText) => {
        handleSuccess(mode, decodedText, idx);
        stopScan();
    }).catch(err => Swal.fire("Error", "Cámara no disponible", "error"));
}

function stopScan() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            document.getElementById('reader-container').classList.add('hidden');
        });
    } else {
        document.getElementById('reader-container').classList.add('hidden');
    }
}

function handleSuccess(mode, code, idx) {
    const dataQR = extraerInfoQR(code);
    
    if (mode === 'fisico') {
        document.getElementById(`valFisico-${idx}`).value = dataQR.mp;
        document.getElementById(`loteFisico-${idx}`).value = dataQR.lote;
        document.getElementById(`provFisico-${idx}`).value = dataQR.prov;

        const status = document.getElementById(`statusFisico-${idx}`);
        status.innerText = "✅ MP: " + dataQR.mp;
        status.style.background = "#dcfce7";
    } else {
        document.getElementById('valMaterialOP').value = dataQR.mp;
        const status = document.getElementById('statusOP');
        status.innerText = "✅ Hoja OP: " + dataQR.mp;
        status.style.background = "#f3e8ff";
    }
}

async function validarYEnviar() {
    const btn = document.querySelector('.btn-submit');
    
    // LOGICA NUEVA PARA OBTENER EL VALIDADOR CORRECTO
    const selectVal = document.getElementById('inputSupervisor');
    const inputOtro = document.getElementById('inputOtroValidador');
    let supervisorFinal = "";
    
    if (selectVal.value === "Otro") {
        supervisorFinal = inputOtro.value.trim();
    } else {
        supervisorFinal = selectVal.value;
    }

    const turno = document.getElementById('selectTurno').value;
    const op = document.getElementById('inputOP').value.trim();
    const matOp = document.getElementById('valMaterialOP').value.trim();
    const cantBobinas = parseInt(document.getElementById('cantBobinas').value);

    let totalMetros = 0;
    let resumenBobinas = [];
    let materialesFisicos = [];
    let lotesFisicos = [];
    let proveedoresFisicos = [];
    
    let faltanDatos = false;

    for (let i = 1; i <= cantBobinas; i++) {
        const m = parseFloat(document.getElementById(`metros-${i}`).value);
        const val = document.getElementById(`valFisico-${i}`).value;
        const lote = document.getElementById(`loteFisico-${i}`).value;
        const prov = document.getElementById(`provFisico-${i}`).value;

        if (isNaN(m) || !val) { faltanDatos = true; break; }
        
        totalMetros += m;
        materialesFisicos.push(val);
        lotesFisicos.push(lote);
        proveedoresFisicos.push(prov);
        
        resumenBobinas.push(`${val} (${i})`);
    }

    if (!supervisorFinal || !op || !matOp || faltanDatos) {
        Swal.fire("Incompleto", "Por favor, complete todos los campos, seleccione validador y escaneos.", "warning");
        return;
    }

    // VIBRACIÓN DEL DISPOSITIVO
    if (navigator.vibrate) {
        navigator.vibrate(200);
    }

    btn.disabled = true;
    Swal.fire({ title: 'Validando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                supervisor: supervisorFinal, 
                turno, op, 
                material_fisico: materialesFisicos.join(", "),
                lotes_fisico: lotesFisicos.join(", "),
                proveedores_fisico: proveedoresFisicos.join(", "),
                material_op: matOp,
                metros_reportados: totalMetros,
                detalle_contexto: `Se escaneo: ${resumenBobinas.join(", ")}; y en la Hoja OP física indicaba: ${matOp}.`
            })
        });
        
        const resData = await response.json();
        
        if (resData.hayIncidencia) {
            Swal.fire({
                title: "⚠️ INCIDENCIA DETECTADA",
                text: resData.observacion,
                icon: "warning",
                confirmButtonText: "Entendido"
            }).then(() => location.reload());
        } else {
            Swal.fire({
                title: "✅ Validación Exitosa",
                text: "Todos los datos coinciden correctamente.",
                icon: "success"
            }).then(() => location.reload());
        }

    } catch (error) {
        Swal.fire("Error", "No se pudo conectar con el servidor.", "error");
        btn.disabled = false;
    }
}