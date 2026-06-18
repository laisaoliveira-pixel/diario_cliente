// ==== API Helper ====
const API_URL = 'api.php';

async function fetchAPI(action, method = 'GET', body = null) {
    const url = `${API_URL}?action=${action}`;
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);
    
    try {
        const res = await fetch(url, options);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Erro na API');
        return json.data;
    } catch (err) {
        console.error(`Erro na ação ${action}:`, err);
        alert(`Erro: ${err.message}`);
        throw err;
    }
}

// ==== utilitários ====
function onlyDigits(s) { return (s || '').replace(/\D/g, ''); }
function maskCpfCnpj(value) {
  let v = onlyDigits(value).slice(0, 14);
  if (v.length <= 11) {
    return v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    return v.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
  }
}
function maskCNPJ(value) {
  const v = onlyDigits(value).slice(0, 14);
  return v.replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}
function isValidCPF(cpf) {
  cpf = onlyDigits(cpf);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0, rest;
  for (let i = 1; i <= 9; i++) sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.substring(9, 10))) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.substring(10, 11))) return false;
  return true;
}
function isValidCNPJ(cnpj) {
  cnpj = onlyDigits(cnpj);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base) => { let pos = base.length - 7, sum = 0; for (let i = 0; i < base.length; i++) { sum += base[i] * pos--; if (pos < 2) pos = 9; } const r = 11 - (sum % 11); return r > 9 ? 0 : r; };
  const b = cnpj.substring(0, 12); const d1 = calc(b); const d2 = calc(b + d1);
  return cnpj === b + String(d1) + String(d2);
}

// ==== BrasilAPI & ReceitaWS ====
async function fetchCNPJ_BrasilAPI(cnpj) { const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`); if (!r.ok) throw new Error('BrasilAPI'); return r.json(); }
async function fetchSimples_ReceitaWS(cnpj) { const r = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`); if (!r.ok) throw new Error('ReceitaWS'); return r.json(); }

// ==== UI Dinâmica Genérica ====
function createInput(labelText, name, placeholder = '') {
  const label = document.createElement('label');
  label.textContent = labelText;
  const br = document.createElement('br');
  const input = document.createElement('input');
  input.type = 'text'; input.name = name; input.placeholder = placeholder;
  label.appendChild(br); label.appendChild(input);
  return label;
}

// ==== Blocos por sindicato ====
function addSindicato() {
  const wrap = document.getElementById('sindicatos');
  const group = document.createElement('div'); group.className = 'group';

  // Cabeçalho sindicato (3.1 e 3.2)
  const gridInfo = document.createElement('div'); gridInfo.className = 'grid-3';
  gridInfo.appendChild(createInput('Código no Sistema', 'sind_codigo'));
  gridInfo.appendChild(createInput('Nome do Sindicato', 'sind_nome'));
  gridInfo.appendChild(createInput('CNPJ do Sindicato', 'sind_cnpj', '00.000.000/0001-00'));
  const gridInfo2 = document.createElement('div'); gridInfo2.className = 'grid-3';
  gridInfo2.appendChild(createInput('Data-base (dd/mm)', 'sind_data_base', '01/05'));
  gridInfo2.appendChild(createInput('Contrato de Experiência (dias)', 'sind_contrato_exp'));
  gridInfo2.appendChild(createInput('Prorrogação (dias)', 'sind_prorrogacao'));
  const piso = createInput('Piso Salarial', 'sind_piso');

  group.appendChild(gridInfo); group.appendChild(gridInfo2); group.appendChild(piso);

  // 3.4 Horas Extras e Adicional Noturno (SEM "considera para médias")
  const he = document.createElement('div'); he.className = 'subcard';
  he.innerHTML = '<h4>3.4 Horas Extras e Adicional Noturno</h4>';
  const heGrid = document.createElement('div'); heGrid.className = 'grid-3';
  const mkHE = (title, p1, p2) => {
    const fs = document.createElement('fieldset');
    const lg = document.createElement('legend'); lg.textContent = title; fs.appendChild(lg);
    fs.appendChild(createInput('%', p1));
    fs.appendChild(createInput('Base de Cálculo', p2, 'Remuneração'));
    return fs;
  };
  heGrid.appendChild(mkHE('Segunda a Sábado', 'he_seg_sab_percentual', 'he_seg_sab_base'));
  heGrid.appendChild(mkHE('Domingos e Feriados', 'he_dom_fer_percentual', 'he_dom_fer_base'));
  heGrid.appendChild(mkHE('Dias Compensados', 'he_comp_percentual', 'he_comp_base'));
  he.appendChild(heGrid);

  const an = document.createElement('fieldset');
  an.style.marginTop = '16px';
  const lg = document.createElement('legend'); lg.textContent = 'Adicional Noturno'; an.appendChild(lg);
  const anGrid = document.createElement('div'); anGrid.className = 'grid-3';
  anGrid.appendChild(createInput('Horário', 'an_horario', '22:00 às 05:00'));
  anGrid.appendChild(createInput('%', 'an_percentual'));
  anGrid.appendChild(createInput('Base de Cálculo', 'an_base', 'Remuneração'));
  an.appendChild(anGrid);
  he.appendChild(an);

  group.appendChild(he);

  // 3.5 Estabilidades (linhas)
  const est = document.createElement('div'); est.className = 'subcard'; est.innerHTML = '<h4>3.5 Estabilidades</h4>';
  const estRows = document.createElement('div'); estRows.className = 'rows'; estRows.dataset.kind = 'est';
  const addEst = () => {
    const row = document.createElement('div'); row.className = 'row';
    ['est_tipo', 'est_dias', 'est_meses', 'est_anos', 'est_condicao'].forEach((n, i) => {
      const inp = document.createElement('input'); inp.type = 'text'; inp.name = n; inp.placeholder = ['Tipo', 'Dias', 'Meses', 'Anos', 'Condição'][i]; row.appendChild(inp);
    });
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Remover'; btn.className = 'remove'; btn.onclick = () => row.remove(); row.appendChild(btn);
    estRows.appendChild(row);
  };
  const btnEst = document.createElement('button'); btnEst.type = 'button'; btnEst.className = 'btn-outline'; btnEst.textContent = '+ Adicionar estabilidade'; btnEst.onclick = addEst;
  est.appendChild(estRows); est.appendChild(btnEst); addEst();
  group.appendChild(est);

  // 3.6 Auxílios (linhas)
  const aux = document.createElement('div'); aux.className = 'subcard'; aux.innerHTML = '<h4>3.6 Auxílios</h4>';
  const auxRows = document.createElement('div'); auxRows.className = 'rows'; auxRows.dataset.kind = 'aux';
  const addAux = () => {
    const row = document.createElement('div'); row.className = 'row';
    ['aux_tipo', 'aux_pu', 'aux_base', 'aux_idade', 'aux_periodo', 'aux_limite'].forEach((n, i) => {
      const inp = document.createElement('input'); inp.type = 'text'; inp.name = n; inp.placeholder = ['Tipo', '% ou Unid.', 'Base', 'Idade', 'Período/Condição', 'Limite'][i]; row.appendChild(inp);
    });
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Remover'; btn.className = 'remove'; btn.onclick = () => row.remove(); row.appendChild(btn);
    auxRows.appendChild(row);
  };
  const btnAux = document.createElement('button'); btnAux.type = 'button'; btnAux.className = 'btn-outline'; btnAux.textContent = '+ Adicionar auxílio'; btnAux.onclick = addAux;
  aux.appendChild(auxRows); aux.appendChild(btnAux); addAux();
  group.appendChild(aux);

  // 3.7 Outras Regras
  const outras = document.createElement('div'); outras.className = 'subcard';
  outras.innerHTML = '<h4>3.7 Outras Regras do Acordo</h4>';
  const txt = document.createElement('textarea'); txt.name = 'regras_acordo_sind'; txt.rows = 3; txt.placeholder = 'Descreva demais regras importantes deste sindicato...';
  outras.appendChild(txt);
  group.appendChild(outras);

  // Remover sindicato
  const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'remove'; rm.textContent = 'Remover sindicato'; rm.onclick = () => group.remove();
  group.appendChild(rm);

  wrap.appendChild(group);
}

function addFilial() {
  const wrap = document.getElementById('filiais');
  const group = document.createElement('div'); group.className = 'group';
  const g1 = document.createElement('div'); g1.className = 'grid-3';
  g1.appendChild(createInput('Razão social (Filial)', 'filial_razao'));
  g1.appendChild(createInput('CNPJ (Filial)', 'filial_cnpj', '00.000.000/0001-00'));
  g1.appendChild(createInput('CNAE Fiscal (Filial)', 'filial_cnae'));
  const g2 = document.createElement('div'); g2.className = 'grid-3';
  g2.appendChild(createInput('Natureza do Estabelecimento', 'filial_natureza'));
  const lblData = createInput('Data de Encerramento (Filial)', 'filial_data'); lblData.querySelector('input').type = 'date'; g2.appendChild(lblData);
  const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'remove'; rm.textContent = 'Remover filial'; rm.onclick = () => group.remove();
  group.appendChild(g1); group.appendChild(g2); group.appendChild(rm); wrap.appendChild(group);
}

function addTutorial() {
  const wrap = document.getElementById('tutoriais');
  const group = document.createElement('div'); group.className = 'group';
  const g = document.createElement('div'); g.className = 'grid-2';
  g.appendChild(createInput('Descrição do Tutorial', 'tut_desc', 'Ex: Como gerar guia de FGTS'));
  g.appendChild(createInput('Link do Tutorial (URL)', 'tut_link', 'https://...'));
  const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'remove'; rm.textContent = 'Remover tutorial'; rm.onclick = () => group.remove();
  group.appendChild(g); group.appendChild(rm); wrap.appendChild(group);
}


// ==== coleta/formatação ====
function getFormData() {
  const fd = new FormData(document.getElementById('form'));
  const data = {};
  const set = (p, v) => { const k = p.split('.'); let c = data; for (let i = 0; i < k.length - 1; i++) { c[k[i]] = c[k[i]] || {}; c = c[k[i]]; } c[k[k.length - 1]] = v; };

  // empresa
  set('empresa.nome_social', fd.get('nome_social') || '');
  set('empresa.cnpj_matriz', fd.get('cnpj_matriz') || '');
  set('empresa.razao_social_matriz', fd.get('razao_social_matriz') || '');
  set('empresa.cnae_matriz', fd.get('cnae_matriz') || '');
  set('empresa.natureza_matriz', fd.get('natureza_matriz') || '');
  set('empresa.data_encerramento_matriz', fd.get('data_encerramento_matriz') || '');

  // filiais
  data.filiais = Array.from(document.querySelectorAll('#filiais .group')).map(g => ({
    razao: g.querySelector('[name="filial_razao"]')?.value || '',
    cnpj: g.querySelector('[name="filial_cnpj"]')?.value || '',
    cnae: g.querySelector('[name="filial_cnae"]')?.value || '',
    natureza: g.querySelector('[name="filial_natureza"]')?.value || '',
    data_encerramento: g.querySelector('[name="filial_data"]')?.value || ''
  }));

  // composicoes
  set('composicoes.simples_nacional', fd.get('simples_nacional') || '');
  set('composicoes.regime_ir', fd.get('regime_ir') || '');
  set('composicoes.fgts_tipo', fd.get('fgts_tipo') || '');
  set('composicoes.observacao_fpas', fd.get('observacao_fpas') || '');
  set('composicoes.desoneracao', fd.get('desoneracao') || '');
  set('composicoes.desoneracao_tipo', fd.get('desoneracao_tipo') || '');
  set('composicoes.compensacao_previdenciaria', fd.get('compensacao_previdenciaria') || '');

  // sindicatos completos
  data.sindicatos = Array.from(document.querySelectorAll('#sindicatos .group')).map((g, idx) => {
    const basic = {
      idx: idx + 1,
      codigo: g.querySelector('[name="sind_codigo"]')?.value || '',
      nome: g.querySelector('[name="sind_nome"]')?.value || '',
      cnpj: g.querySelector('[name="sind_cnpj"]')?.value || '',
      data_base: g.querySelector('[name="sind_data_base"]')?.value || '',
      contrato_experiencia: g.querySelector('[name="sind_contrato_exp"]')?.value || '',
      prorrogacao: g.querySelector('[name="sind_prorrogacao"]')?.value || '',
      piso: g.querySelector('[name="sind_piso"]')?.value || ''
    };
    const he = [{ dia: 'Segunda a Sábado', percentual: g.querySelector('[name="he_seg_sab_percentual"]')?.value || '', base: g.querySelector('[name="he_seg_sab_base"]')?.value || '' },
    { dia: 'Domingos e Feriados', percentual: g.querySelector('[name="he_dom_fer_percentual"]')?.value || '', base: g.querySelector('[name="he_dom_fer_base"]')?.value || '' },
    { dia: 'Dias Compensados', percentual: g.querySelector('[name="he_comp_percentual"]')?.value || '', base: g.querySelector('[name="he_comp_base"]')?.value || '' }];
    const an = { horario: g.querySelector('[name="an_horario"]')?.value || '', percentual: g.querySelector('[name="an_percentual"]')?.value || '', base: g.querySelector('[name="an_base"]')?.value || '' };
    const estRows = Array.from(g.querySelectorAll('[data-kind="est"] .row')).map(r => ({
      tipo: r.querySelector('[name="est_tipo"]')?.value || '',
      dias: r.querySelector('[name="est_dias"]')?.value || '',
      meses: r.querySelector('[name="est_meses"]')?.value || '',
      anos: r.querySelector('[name="est_anos"]')?.value || '',
      condicao: r.querySelector('[name="est_condicao"]')?.value || ''
    }));
    const auxRows = Array.from(g.querySelectorAll('[data-kind="aux"] .row')).map(r => ({
      tipo: r.querySelector('[name="aux_tipo"]')?.value || '',
      percentual_ou_unidade: r.querySelector('[name="aux_pu"]')?.value || '',
      base: r.querySelector('[name="aux_base"]')?.value || '',
      idade: r.querySelector('[name="aux_idade"]')?.value || '',
      periodo: r.querySelector('[name="aux_periodo"]')?.value || '',
      limite: r.querySelector('[name="aux_limite"]')?.value || ''
    }));
    const regras = g.querySelector('[name="regras_acordo_sind"]')?.value || '';
    return { basic, horas_extras: he, adicional_noturno: an, estabilidades: estRows, auxilios: auxRows, outras_regras: regras };
  });

  // demais
  data.feriados_municipios = fd.get('feriados_municipios') || '';
  data.provisoes_tipo = fd.get('provisoes_tipo') || '';
  data.provisoes = fd.get('provisoes') || '';
  data.pat = fd.get('pat') || '';
  data.politicas = { numeracao_matricula: fd.get('numeracao_matricula') || '', admissao: fd.get('politica_admissao') || '', transferencia: fd.get('politica_transferencia') || '' };
  data.adiantamento = { todas_empresas: fd.get('adiant_todas_empresas') || '', percentual: fd.get('adiant_percentual') || '', dias_minimos: fd.get('adiant_dias_min') || '', ferias_proporcional: fd.get('adiant_ferias_prop') || '', admitidos_regra: fd.get('adiant_admitidos') || '', estagiarios_recebem: fd.get('adiant_estagiarios') || '', descontos_adicionais: fd.get('adiant_descontos') || '', data_pagamento: fd.get('adiant_data_pagamento') || '', data_nao_util: fd.get('adiant_data_nao_util') || '', pro_labore: fd.get('adiant_pro_labore') || '', sequencial_processos: fd.get('adiant_sequencial') || '' };
  data.folha = { data_pagamento: fd.get('folha_data_pagamento') || '', dia_fixo: fd.get('folha_dia_fixo') || '', nao_util: fd.get('folha_nao_util') || '', tipos_mao_de_obra: Array.from(document.querySelectorAll('[name="tipos_mao_obra"]:checked')).map(i => i.value), regras_especificas: fd.get('regras_especificas') || '', outras_particularidades: fd.get('outras_particularidades') || '', sequencial: fd.get('folha_sequencial') || '' };
  data.rescisao = { desconta_aviso_pedido_demissao: fd.get('desc_aviso_pedido_demissao') || '', desc_metade_art480: fd.get('desc_metade_art480') || '', cliente_informa_desconto: fd.get('cliente_informa_desc') || '', sequencial: fd.get('rescisao_sequencial') || '' };
  data.decimo_terceiro = { adiantamento_data: fd.get('dt_adiantamento_data') || '', adiantamento_nao_util: fd.get('dt_adiantamento_nao_util') || '', considera_medias: fd.get('dt_considera_medias') || '', pagamento_data: fd.get('dt_pagamento_data') || '', pagamento_nao_util: fd.get('dt_pagamento_nao_util') || '', sequencial: fd.get('dt_sequencial') || '' };
  data.ferias = { forma_pagamento_13: Array.from(document.querySelectorAll('[name="ferias_forma_13"]:checked')).map(i => i.value), percentual_adiantamento_13: fd.get('ferias_percentual_13') || '', antecipa_ferias: fd.get('ferias_antecipa') || '', abate_faltas: fd.get('ferias_abate_faltas') || '' };
  data.dados_bancarios = { tipos_pagamento: Array.from(document.querySelectorAll('[name="pagamento_bancario"]:checked')).map(i => i.value), modelo_arquivo_obs: fd.get('modelo_arquivo_obs') || '' };
  data.tomadores_servico = fd.get('tomadores_servico') || '';
  data.autonomos = { tem_autonomos: fd.get('autonomos_tem') || '', processo_rpa: fd.get('autonomos_rpa') || '' };
  data.estagiarios = { tem_estagiarios: fd.get('estag_tem') || '', paga_bolsa: fd.get('estag_bolsa') || '', recesso_30_dias: fd.get('estag_recesso') || '', paga_13: fd.get('estag_13') || '', paga_recesso_proporcional: fd.get('estag_recesso_prop') || '', observacoes: fd.get('estag_obs') || '' };

  // tutoriais
  data.tutoriais = Array.from(document.querySelectorAll('#tutoriais .group')).map(g => ({
    descricao: g.querySelector('[name="tut_desc"]')?.value || '',
    link: g.querySelector('[name="tut_link"]')?.value || ''
  }));

  data.termo_local_data = fd.get('termo_local_data') || ''; 
  data.responsavel_preenchimento = fd.get('responsavel') || ''; 
  data.analista_responsavel = fd.get('analista_responsavel') || '';
  data.coordenacao = fd.get('coordenacao') || '';
  return data;
}

// ==== Exportações ====
function sheetFromList(list) { if (!list || !list.length) return XLSX.utils.aoa_to_sheet([['—']]); const h = Object.keys(list[0]); const rows = [h, ...list.map(o => h.map(k => o[k] ?? ''))]; return XLSX.utils.aoa_to_sheet(rows); }
function exportExcel(data) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([data.empresa]), 'Empresa');
  XLSX.utils.book_append_sheet(wb, sheetFromList(data.filiais), 'Filiais');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([data.composicoes]), 'Composicoes');
  // Sindicatos: abas separadas
  const sindBasic = data.sindicatos.map(s => ({ idx: s.basic.idx, ...s.basic }));
  XLSX.utils.book_append_sheet(wb, sheetFromList(sindBasic), 'Sindicatos');
  const sindHE = data.sindicatos.flatMap(s => s.horas_extras.map(he => ({ sind_idx: s.basic.idx, sind_nome: s.basic.nome, ...he })));
  XLSX.utils.book_append_sheet(wb, sheetFromList(sindHE), 'Sind_HorasExtras');
  const sindAN = data.sindicatos.map(s => ({ sind_idx: s.basic.idx, sind_nome: s.basic.nome, ...s.adicional_noturno }));
  XLSX.utils.book_append_sheet(wb, sheetFromList(sindAN), 'Sind_AdicNoturno');
  const sindEst = data.sindicatos.flatMap(s => s.estabilidades.map(e => ({ sind_idx: s.basic.idx, sind_nome: s.basic.nome, ...e })));
  XLSX.utils.book_append_sheet(wb, sheetFromList(sindEst), 'Sind_Estabilidades');
  const sindAux = data.sindicatos.flatMap(s => s.auxilios.map(a => ({ sind_idx: s.basic.idx, sind_nome: s.basic.nome, ...a })));
  XLSX.utils.book_append_sheet(wb, sheetFromList(sindAux), 'Sind_Auxilios');
  const sindOutras = data.sindicatos.map(s => ({ sind_idx: s.basic.idx, sind_nome: s.basic.nome, outras_regras: s.outras_regras }));
  XLSX.utils.book_append_sheet(wb, sheetFromList(sindOutras), 'Sind_OutrasRegras');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ RegrasAcordo: data.regras_acordo, FeriadosMunicipios: data.feriados_municipios, Provisoes: data.provisoes, Provisoes_Tipo: data.provisoes_tipo, PAT: data.pat }]), 'RegrasGerais');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([data.politicas]), 'Politicas');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([data.adiantamento]), 'Adiantamento');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([data.folha]), 'Folha');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([data.rescisao]), 'Rescisao');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([data.decimo_terceiro]), '13_Salario');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([data.ferias]), 'Ferias');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([data.dados_bancarios]), 'DadosBancarios');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ TomadoresServico: data.tomadores_servico }]), 'Tomadores');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([data.autonomos]), 'Autonomos');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([data.estagiarios]), 'Estagiarios');
  XLSX.utils.book_append_sheet(wb, sheetFromList(data.gatilhos), 'Gatilhos');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ LocalData: data.termo_local_data, Responsavel: data.responsavel_preenchimento, Analista: data.analista_responsavel, Coordenacao: data.coordenacao }]), 'Termo');
  XLSX.writeFile(wb, `checklist_srh_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`);
}

function exportPDF(data) {
  const { jsPDF } = window.jspdf; 
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const m = 28; let y = m; const gap = 12;

  const checkPage = (height) => { if (y + height > 800) { doc.addPage(); y = m; } };

  const title = (t) => { 
    checkPage(30); 
    y += 10;
    doc.setFillColor(0, 60, 113); // Azul corporativo
    doc.rect(m, y, 539, 22, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(255, 255, 255);
    doc.text(t, m + 6, y + 15); 
    y += 32; 
    doc.setTextColor(0, 0, 0); 
  };
  
  const sub = (t) => { 
    checkPage(20); 
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0, 60, 113);
    doc.text(t, m, y += 16); y += 6; 
    doc.setTextColor(0, 0, 0);
  };
  
  const txt = (t) => { 
    checkPage(14); 
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); 
    const lines = doc.splitTextToSize(t, 539); 
    doc.text(lines, m, y += 12); 
    y += (lines.length - 1) * 12 + 6; 
  };

  const tableManual = (head, body) => {
    if (!body || !body.length) return;
    doc.autoTable({ 
      startY: y, 
      head: head, 
      body: body, 
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 4, lineColor: [200, 200, 200] }, 
      margin: { left: m, right: m } 
    });
    y = doc.lastAutoTable.finalY + gap;
  };

  // Header
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(0, 60, 113);
  doc.text('BERNHOEFT', m, y += 18);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(100, 100, 100);
  doc.text('BPO de Folha de Pagamento', m, y += 14); y += 16;
  
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(0, 0, 0);
  doc.text('CARTILHA OPERACIONAL', m, y += 16); 
  
  const empresaNome = data.empresa?.nome_social || data.empresa?.razao_social_matriz || 'NOME DA EMPRESA';
  doc.setFontSize(14); doc.setTextColor(0, 60, 113);
  doc.text(empresaNome, m, y += 18);
  
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 120, 120);
  doc.text('Operação Aeroportuária   |   Sistema LG   |   Atendimento High Touch', m, y += 16);
  doc.text('Versão MVP 1.0   |   Confidencial — Uso Interno', m, y += 12);
  doc.setTextColor(0, 0, 0);
  y += gap + 8;

  // 1. A Conta em 1 Página
  title('1. A Conta em 1 Página');
  sub('Identificação');
  const sindicatosNomes = (data.sindicatos || []).map(s => s.basic?.nome).filter(Boolean).join(', ');
  tableManual([['Atributo', 'Informação']], [
    ['Razão Social / CNPJs', `${data.empresa?.razao_social_matriz || ''} / ${data.empresa?.cnpj_matriz || ''}`],
    ['Headcount aprox.', ''],
    ['Unidades / aeroportos', data.filiais?.length ? `${data.filiais.length} filiais` : ''],
    ['Sindicatos vinculados', sindicatosNomes],
    ['Dia de pagamento', data.folha?.data_pagamento || ''],
    ['Coordenador Bernhoeft', data.coordenacao || ''],
    ['Coordenador RH (ponto focal nº1)', ''],
    ['Diretor RH', '']
  ]);

  sub('3 prioridades inegociáveis');
  txt('1. Pagamento no prazo, sem surpresa de última hora.');
  txt('2. eSocial, INSS, FGTS e IRRF dentro do prazo legal.');
  txt('3. Confidencialidade absoluta.');
  y += gap;

  // 2. Quem é Quem
  title('2. Quem é Quem');
  sub('Time Bernhoeft na conta');
  tableManual([['Papel', 'Nome', 'Contato', 'Backup']], [
    ['Gerente de Conta', '', '', ''],
    ['Coordenador Operacional', data.coordenacao || '', '', ''],
    ['Analista Sênior (líder técnico)', data.analista_responsavel || '', '', ''],
    ['Analista Folha', data.responsavel_preenchimento || '', '', ''],
    ['Analista Benefícios', '', '', ''],
    ['Analista Ponto', '', '', '']
  ]);

  sub('Pontos focais');
  tableManual([['Cargo / Área', 'Nome', 'Tema', 'Canal preferencial']], [
    ['Gerente de RH (patrocinador)', '', 'Aprovação folha, decisões', 'E-mail formal'],
    ['Coord. DP', '', 'Operação diária', 'E-mail + chamado'],
    ['Resp. Benefícios', '', 'VR/VA/VT, plano saúde', 'E-mail'],
    ['Resp. Ponto', '', 'Fechamento ponto', 'E-mail'],
    ['Financeiro', '', 'CNAB, pagamentos', 'E-mail'],
    ['Contábil/Controladoria', '', 'Contabilização, provisões', 'E-mail']
  ]);

  sub('Quem aprova o quê');
  tableManual([['Tema', 'Aprovador', 'Forma']], [
    ['Folha do mês', 'Gerente RH', 'E-mail formal'],
    ['Rescisão', 'Gerente RH', 'E-mail formal'],
    ['Admissão / proposta', 'Gerente RH', 'E-mail / sistema'],
    ['Exceção', 'Diretor RH', 'E-mail + justificativa'],
    ['Movimentação fora do cut-off', 'Coord. DP + Coord. Bern.', 'E-mail formal']
  ]);

  sub('REGRA DE OURO DE COMUNICAÇÃO');
  txt('Aprovação ou decisão SEM e-mail = não aconteceu. WhatsApp e ligação servem para acionar; nunca para evidenciar.');
  y += gap;

  // 3. Particularidades-Chave
  title('3. Particularidades-Chave');
  sub('Folha, ponto e adicionais');
  const tiposMaoObra = (data.folha?.tipos_mao_de_obra || []).join(', ');
  const infoNoturno = (data.sindicatos || []).map(s => s.adicional_noturno?.percentual ? `${s.adicional_noturno.percentual} (${s.basic?.nome})` : '').filter(Boolean).join(', ');
  tableManual([['Item', 'Regra']], [
    ['Vínculos existentes', tiposMaoObra],
    ['Adicional noturno', infoNoturno],
    ['Periculosidade', ''],
    ['Insalubridade', ''],
    ['Escalas', ''],
    ['Sobreaviso / prontidão', ''],
    ['Banco de horas', ''],
    ['Cargos de confiança (art. 62)', ''],
    ['Expatriados / executivos', ''],
    ['Sistema de ponto', ''],
    ['Contabilização', '']
  ]);

  sub('Sindicatos');
  const sindRows = (data.sindicatos || []).map(s => [
    s.basic?.nome || '', 
    s.basic?.data_base || '', 
    s.basic?.piso ? `Piso: ${s.basic.piso}` : '', 
    s.outras_regras || ''
  ]);
  if (!sindRows.length) sindRows.push(['', '', '', '']);
  tableManual([['Categoria / Sindicato', 'Data-base', 'CCT vigente', 'Particularidades']], sindRows);

  sub('Benefícios');
  tableManual([['Benefício', 'Fornecedor', 'Cut-off envio', 'Reflexo em folha']], [
    ['Vale Transporte', '', '', ''],
    ['VR / VA', '', '', ''],
    ['Plano de saúde', '', '', ''],
    ['Plano odontológico', '', '', ''],
    ['Seguro de vida', '', '', ''],
    ['Outros', '', '', '']
  ]);

  // 4. Calendário do Mês e Prazos Críticos
  title('4. Calendário do Mês e Prazos Críticos');
  tableManual([['Dia', 'Atividade', 'Responsável Bern.', 'Risco se atrasar']], [
    ['D-10', 'Validar parâmetros do mês', 'Sênior', 'Erro sistêmico'],
    ['D-8', 'Cut-off de movimentações', 'Coord.', 'Mov. fora do prazo'],
    ['D-7 a D-6', 'Lançamento de movimentações', 'Folha', 'Falha de base'],
    ['D-5', '1º cálculo da folha', 'Folha', 'Reprocessos'],
    ['D-4', 'Conferência 4 olhos', 'Sênior + Folha', 'Erro no cliente'],
    ['D-3', 'Envio do espelho', 'Coord.', 'Estouro da janela'],
    ['D-2', 'Ajustes + reprocesso', 'Folha', 'Atraso pagamento'],
    ['D-1 (11h)', 'Geração e envio CNAB', 'Sênior', 'Atraso no banco'],
    ['D0', 'Liberação contracheques', 'Folha', 'Reclamação'],
    ['Até dia 7', 'Recolhimento FGTS', 'Sênior', 'Multa CAIXA'],
    ['Até dia 15', 'Envio eSocial S-1299', 'Sênior', 'Multa eSocial']
  ]);

  // 5. Checklists Essenciais
  title('5. Checklists Essenciais');
  sub('5.1. Fechamento');
  tableManual([['Item', 'Risco se não checado']], [
    ['Parâmetros do mês validados', 'Erro sistêmico'],
    ['Movimentações lançadas', 'Pessoa fora da folha'],
    ['Ponto importado e tratado', 'HE/AN errado'],
    ['Conferência 4 olhos', 'Sem evidência'],
    ['Resumo executivo escrito', 'Cliente surpreendido']
  ]);

  sub('5.2. Admissão');
  tableManual([['Item', 'Quando', 'Risco']], [
    ['Documentação completa', 'Antes do 1º dia', 'Início inválido'],
    ['S-2200 enviado', 'D-1 ou D0', 'Multa eSocial']
  ]);

  sub('5.3. Rescisão');
  tableManual([['Item', 'Risco']], [
    ['TRCT calculado + 4 olhos', 'Erro ao colaborador'],
    ['Pagamento até 10º dia (CLT 477)', 'Multa 1 salário']
  ]);

  sub('5.4. Férias');
  tableManual([['Item', 'Prazo legal']], [
    ['Aviso de férias 30 dias', 'CLT art. 135'],
    ['Pagamento 2 dias antes', 'CLT art. 145']
  ]);

  // 6. Riscos e Lições
  title('6. Riscos e Lições');
  tableManual([['Data', 'O que aconteceu', 'Causa', 'O que mudou na rotina']], [
    ['', '', '', '']
  ]);

  doc.save(`cartilha_operacional_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`);
}

// ==== navegação e salvamento ====
function fillForm(data, scrollToSection = null) {
  const form = document.getElementById('form');
  form.reset();

  const setInp = (name, val) => {
    const el = form.querySelector(`[name="${name}"]`);
    if (el && el.type !== 'radio' && el.type !== 'checkbox') el.value = val || '';
  };
  const setRadio = (name, val) => {
    if (!val) return;
    const el = form.querySelector(`[name="${name}"][value="${val}"]`);
    if (el) el.checked = true;
  };
  const setCheck = (name, arr) => {
    if (!arr || !Array.isArray(arr)) return;
    arr.forEach(val => {
      const el = form.querySelector(`[name="${name}"][value="${val}"]`);
      if (el) el.checked = true;
    });
  };

  if (data.empresa) {
    setInp('nome_social', data.empresa.nome_social);
    setInp('cnpj_matriz', data.empresa.cnpj_matriz);
    setInp('razao_social_matriz', data.empresa.razao_social_matriz);
    setInp('cnae_matriz', data.empresa.cnae_matriz);
    setInp('natureza_matriz', data.empresa.natureza_matriz);
    setInp('data_encerramento_matriz', data.empresa.data_encerramento_matriz);
  }
  if (data.composicoes) {
    setInp('simples_nacional', data.composicoes.simples_nacional);
    setInp('regime_ir', data.composicoes.regime_ir);
    setInp('fgts_tipo', data.composicoes.fgts_tipo);
    setInp('observacao_fpas', data.composicoes.observacao_fpas);
    setInp('desoneracao', data.composicoes.desoneracao);
    setInp('desoneracao_tipo', data.composicoes.desoneracao_tipo);
    setInp('compensacao_previdenciaria', data.composicoes.compensacao_previdenciaria);
  }
  setInp('feriados_municipios', data.feriados_municipios);
  setRadio('provisoes_tipo', data.provisoes_tipo);
  setInp('provisoes', data.provisoes);
  setInp('pat', data.pat);

  if (data.politicas) {
    setInp('numeracao_matricula', data.politicas.numeracao_matricula);
    setInp('politica_admissao', data.politicas.admissao);
    setInp('politica_transferencia', data.politicas.transferencia);
  }

  if (data.adiantamento) {
    setInp('adiant_todas_empresas', data.adiantamento.todas_empresas);
    setInp('adiant_percentual', data.adiantamento.percentual);
    setInp('adiant_dias_min', data.adiantamento.dias_minimos);
    setInp('adiant_ferias_prop', data.adiantamento.ferias_proporcional);
    setInp('adiant_admitidos', data.adiantamento.admitidos_regra);
    setInp('adiant_estagiarios', data.adiantamento.estagiarios_recebem);
    setInp('adiant_descontos', data.adiantamento.descontos_adicionais);
    setInp('adiant_data_pagamento', data.adiantamento.data_pagamento);
    setInp('adiant_data_nao_util', data.adiantamento.data_nao_util);
    setInp('adiant_pro_labore', data.adiantamento.pro_labore);
    setInp('adiant_sequencial', data.adiantamento.sequencial_processos);
  }

  if (data.folha) {
    setInp('folha_data_pagamento', data.folha.data_pagamento);
    setInp('folha_dia_fixo', data.folha.dia_fixo);
    setInp('folha_nao_util', data.folha.nao_util);
    setCheck('tipos_mao_obra', data.folha.tipos_mao_de_obra);
    setInp('regras_especificas', data.folha.regras_especificas);
    setInp('outras_particularidades', data.folha.outras_particularidades);
    setInp('folha_sequencial', data.folha.sequencial);
  }

  if (data.rescisao) {
    setInp('desc_aviso_pedido_demissao', data.rescisao.desconta_aviso_pedido_demissao);
    setInp('desc_metade_art480', data.rescisao.desc_metade_art480);
    setInp('cliente_informa_desc', data.rescisao.cliente_informa_desconto);
    setInp('rescisao_sequencial', data.rescisao.sequencial);
  }

  if (data.decimo_terceiro) {
    setInp('dt_adiantamento_data', data.decimo_terceiro.adiantamento_data);
    setInp('dt_adiantamento_nao_util', data.decimo_terceiro.adiantamento_nao_util);
    setInp('dt_considera_medias', data.decimo_terceiro.considera_medias);
    setInp('dt_pagamento_data', data.decimo_terceiro.pagamento_data);
    setInp('dt_pagamento_nao_util', data.decimo_terceiro.pagamento_nao_util);
    setInp('dt_sequencial', data.decimo_terceiro.sequencial);
  }

  if (data.ferias) {
    setCheck('ferias_forma_13', data.ferias.forma_pagamento_13);
    setInp('ferias_percentual_13', data.ferias.percentual_adiantamento_13);
    setInp('ferias_antecipa', data.ferias.antecipa_ferias);
    setInp('ferias_abate_faltas', data.ferias.abate_faltas);
  }

  if (data.dados_bancarios) {
    setCheck('pagamento_bancario', data.dados_bancarios.tipos_pagamento);
    setInp('modelo_arquivo_obs', data.dados_bancarios.modelo_arquivo_obs);
  }

  setInp('tomadores_servico', data.tomadores_servico);

  if (data.autonomos) {
    setInp('autonomos_tem', data.autonomos.tem_autonomos);
    setInp('autonomos_rpa', data.autonomos.processo_rpa);
  }

  if (data.estagiarios) {
    setInp('estag_tem', data.estagiarios.tem_estagiarios);
    setInp('estag_bolsa', data.estagiarios.paga_bolsa);
    setInp('estag_recesso', data.estagiarios.recesso_30_dias);
    setInp('estag_13', data.estagiarios.paga_13);
    setInp('estag_recesso_prop', data.estagiarios.paga_recesso_proporcional);
    setInp('estag_obs', data.estagiarios.observacoes);
  }

  setInp('termo_local_data', data.termo_local_data);
  setInp('responsavel', data.responsavel_preenchimento);
  setInp('analista_responsavel', data.analista_responsavel);
  setInp('coordenacao', data.coordenacao);

  document.getElementById('tutoriais').innerHTML = '';
  if (data.tutoriais && data.tutoriais.length) {
    data.tutoriais.forEach(t => {
      addTutorial();
      const groups = document.querySelectorAll('#tutoriais .group');
      const last = groups[groups.length - 1];
      last.querySelector('[name="tut_desc"]').value = t.descricao || '';
      last.querySelector('[name="tut_link"]').value = t.link || '';
    });
  }

  document.getElementById('filiais').innerHTML = '';
  if (data.filiais && data.filiais.length) {
    data.filiais.forEach(f => {
      addFilial();
      const groups = document.querySelectorAll('#filiais .group');
      const last = groups[groups.length - 1];
      last.querySelector('[name="filial_razao"]').value = f.razao || '';
      last.querySelector('[name="filial_cnpj"]').value = f.cnpj || '';
      last.querySelector('[name="filial_cnae"]').value = f.cnae || '';
      last.querySelector('[name="filial_natureza"]').value = f.natureza || '';
      last.querySelector('[name="filial_data"]').value = f.data_encerramento || '';
    });
  }

  document.getElementById('sindicatos').innerHTML = '';
  if (data.sindicatos && data.sindicatos.length) {
    data.sindicatos.forEach(s => {
      addSindicato();
      const groups = document.querySelectorAll('#sindicatos .group');
      const last = groups[groups.length - 1];

      if (s.basic) {
        last.querySelector('[name="sind_codigo"]').value = s.basic.codigo || '';
        last.querySelector('[name="sind_nome"]').value = s.basic.nome || '';
        last.querySelector('[name="sind_cnpj"]').value = s.basic.cnpj || '';
        last.querySelector('[name="sind_data_base"]').value = s.basic.data_base || '';
        last.querySelector('[name="sind_contrato_exp"]').value = s.basic.contrato_experiencia || '';
        last.querySelector('[name="sind_prorrogacao"]').value = s.basic.prorrogacao || '';
        last.querySelector('[name="sind_piso"]').value = s.basic.piso || '';
      }
      if (s.horas_extras && s.horas_extras.length >= 3) {
        last.querySelector('[name="he_seg_sab_percentual"]').value = s.horas_extras[0].percentual || '';
        last.querySelector('[name="he_seg_sab_base"]').value = s.horas_extras[0].base || '';
        last.querySelector('[name="he_dom_fer_percentual"]').value = s.horas_extras[1].percentual || '';
        last.querySelector('[name="he_dom_fer_base"]').value = s.horas_extras[1].base || '';
        last.querySelector('[name="he_comp_percentual"]').value = s.horas_extras[2].percentual || '';
        last.querySelector('[name="he_comp_base"]').value = s.horas_extras[2].base || '';
      }
      if (s.adicional_noturno) {
        last.querySelector('[name="an_horario"]').value = s.adicional_noturno.horario || '';
        last.querySelector('[name="an_percentual"]').value = s.adicional_noturno.percentual || '';
        last.querySelector('[name="an_base"]').value = s.adicional_noturno.base || '';
      }

      const estRows = last.querySelector('[data-kind="est"]');
      estRows.innerHTML = '';
      if (s.estabilidades && s.estabilidades.length) {
        s.estabilidades.forEach(est => {
          const row = document.createElement('div'); row.className = 'row';
          ['est_tipo', 'est_dias', 'est_meses', 'est_anos', 'est_condicao'].forEach((n, i) => {
            const inp = document.createElement('input'); inp.type = 'text'; inp.name = n;
            inp.placeholder = ['Tipo', 'Dias', 'Meses', 'Anos', 'Condição'][i];
            const valMap = [est.tipo, est.dias, est.meses, est.anos, est.condicao];
            inp.value = valMap[i] || '';
            row.appendChild(inp);
          });
          const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Remover'; btn.className = 'remove'; btn.onclick = () => row.remove(); row.appendChild(btn);
          estRows.appendChild(row);
        });
      }

      const auxRows = last.querySelector('[data-kind="aux"]');
      auxRows.innerHTML = '';
      if (s.auxilios && s.auxilios.length) {
        s.auxilios.forEach(aux => {
          const row = document.createElement('div'); row.className = 'row';
          ['aux_tipo', 'aux_pu', 'aux_base', 'aux_idade', 'aux_periodo', 'aux_limite'].forEach((n, i) => {
            const inp = document.createElement('input'); inp.type = 'text'; inp.name = n;
            inp.placeholder = ['Tipo', '% ou Unid.', 'Base', 'Idade', 'Período/Condição', 'Limite'][i];
            const valMap = [aux.tipo, aux.percentual_ou_unidade, aux.base, aux.idade, aux.periodo, aux.limite];
            inp.value = valMap[i] || '';
            row.appendChild(inp);
          });
          const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Remover'; btn.className = 'remove'; btn.onclick = () => row.remove(); row.appendChild(btn);
          auxRows.appendChild(row);
        });
      }

      last.querySelector('[name="regras_acordo_sind"]').value = s.outras_regras || '';
    });
  }

  const gatilhosList = document.getElementById('gatilhos_list');
  gatilhosList.innerHTML = '';
  if (data.gatilhos && data.gatilhos.length) {
    data.gatilhos.forEach(g => {
      const safeDesc = (g.descricao || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const renderedDesc = typeof renderMarkdownImages === 'function' ? renderMarkdownImages(safeDesc) : safeDesc;
      gatilhosList.innerHTML += `
        <div style="border: 1px solid var(--card-border); padding: 12px; margin-bottom: 8px; border-radius: 8px; background: rgba(0,0,0,0.1);">
          <strong style="color:var(--accent1)">Data:</strong> ${g.data} &nbsp;|&nbsp;
          <strong style="color:var(--accent1)">Motivo:</strong> ${g.motivo}<br>
          <strong style="color:var(--accent1)">Descrição:</strong> <div>${renderedDesc}</div>
        </div>
      `;
    });
  } else {
    gatilhosList.innerHTML = '<p class="muted">Nenhum gatilho registrado.</p>';
  }

  document.getElementById('home_view').style.display = 'none';
  document.getElementById('form_view').style.display = 'block';

  if (typeof deserializeAll === 'function') {
    deserializeAll();
  }

  if (scrollToSection) {
    const el = document.getElementById(scrollToSection);
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  } else {
    window.scrollTo(0, 0);
  }
}

async function verEmpresa(id, scrollToSection = null) {
  try {
    const d = await fetchAPI('obter_empresa&id=' + id);
    if (d) {
      document.getElementById('form').dataset.editId = id;
      fillForm(d, scrollToSection);
    }
  } catch (err) {
    console.error("Erro ao carregar empresa:", err);
  }
}

function novaParticularidade() {
  const form = document.getElementById('form');
  form.reset();
  delete form.dataset.editId;
  document.getElementById('filiais').innerHTML = '';
  document.getElementById('sindicatos').innerHTML = '';
  document.getElementById('tutoriais').innerHTML = '';
  document.getElementById('gatilhos_list').innerHTML = '<p class="muted">Salve a empresa primeiro para adicionar gatilhos.</p>';
  addFilial(); addSindicato(); addTutorial();
  document.getElementById('home_view').style.display = 'none';
  document.getElementById('form_view').style.display = 'block';
}


function voltarHome() {
  document.getElementById('form_view').style.display = 'none';
  const cv = document.getElementById('checklist_view');
  if (cv) cv.style.display = 'none';
  const iv = document.getElementById('incidencias_view');
  if (iv) iv.style.display = 'none';
  document.getElementById('home_view').style.display = 'block';
  renderListaEmpresas();
}

function formatDataToWebhook(data) {
  const getArr = (v) => Array.isArray(v) ? v.join(', ') : String(v||'');
  const getStr = (v) => String(v||'');
  const lastGatilho = data.gatilhos && data.gatilhos.length > 0 ? data.gatilhos[data.gatilhos.length - 1] : {};

  return {
    cnpj_matriz: getStr(data.empresa?.cnpj_matriz),
    nome_social: getStr(data.empresa?.nome_social),
    razao_social_matriz: getStr(data.empresa?.razao_social_matriz),
    cnae_matriz: getStr(data.empresa?.cnae_matriz),
    natureza_matriz: getStr(data.empresa?.natureza_matriz),
    data_encerramento_matriz: getStr(data.empresa?.data_encerramento_matriz),
    filiais: JSON.stringify(data.filiais || []),
    sindicatos: JSON.stringify(data.sindicatos || []),
    simples_nacional: getStr(data.composicoes?.simples_nacional),
    regime_ir: getStr(data.composicoes?.regime_ir),
    fgts_tipo: getStr(data.composicoes?.fgts_tipo),
    observacao_fpas: getStr(data.composicoes?.observacao_fpas),
    desoneracao: getStr(data.composicoes?.desoneracao),
    desoneracao_tipo: getStr(data.composicoes?.desoneracao_tipo),
    compensacao_previdenciaria: getStr(data.composicoes?.compensacao_previdenciaria),
    feriados_municipios: getStr(data.feriados_municipios),
    provisoes_tipo: getStr(data.provisoes_tipo),
    provisoes_obs: getStr(data.provisoes),
    pat: getStr(data.pat),
    numeracao_matricula: getStr(data.politicas?.numeracao_matricula),
    admissao: getStr(data.politicas?.admissao),
    transferencia: getStr(data.politicas?.transferencia),
    adiantamento_todas_empresas: getStr(data.adiantamento?.todas_empresas),
    adiantamento_percentual: getStr(data.adiantamento?.percentual),
    adiantamento_dias_minimos: getStr(data.adiantamento?.dias_minimos),
    adiantamento_ferias_proporcional: getStr(data.adiantamento?.ferias_proporcional),
    adiantamento_admitidos_regra: getStr(data.adiantamento?.admitidos_regra),
    adiantamento_estagiarios_recebem: getStr(data.adiantamento?.estagiarios_recebem),
    adiantamento_descontos_adicionais: getStr(data.adiantamento?.descontos_adicionais),
    adiantamento_data_pagamento: getStr(data.adiantamento?.data_pagamento),
    adiantamento_data_nao_util: getStr(data.adiantamento?.data_nao_util),
    adiantamento_pro_labore: getStr(data.adiantamento?.pro_labore),
    adiantamento_sequencial_processos: getStr(data.adiantamento?.sequencial_processos),
    folha_data_pagamento: getStr(data.folha?.data_pagamento),
    folha_dia_fixo: getStr(data.folha?.dia_fixo),
    folha_nao_util: getStr(data.folha?.nao_util),
    folha_tipos_mao_de_obra: getArr(data.folha?.tipos_mao_de_obra),
    folha_regras_especificas: getStr(data.folha?.regras_especificas),
    folha_outras_particularidades: getStr(data.folha?.outras_particularidades),
    folha_sequencial: getStr(data.folha?.sequencial),
    rescisao_desconta_aviso_pedido_demissao: getStr(data.rescisao?.desconta_aviso_pedido_demissao),
    rescisao_desc_metade_art480: getStr(data.rescisao?.desc_metade_art480),
    rescisao_cliente_informa_desconto: getStr(data.rescisao?.cliente_informa_desconto),
    rescisao_sequencial: getStr(data.rescisao?.sequencial),
    decimo_adiantamento_data: getStr(data.decimo_terceiro?.adiantamento_data),
    decimo_adiantamento_nao_util: getStr(data.decimo_terceiro?.adiantamento_nao_util),
    decimo_considera_medias: getStr(data.decimo_terceiro?.considera_medias),
    decimo_pagamento_data: getStr(data.decimo_terceiro?.pagamento_data),
    decimo_pagamento_nao_util: getStr(data.decimo_terceiro?.pagamento_nao_util),
    decimo_sequencial: getStr(data.decimo_terceiro?.sequencial),
    ferias_forma_pagamento_13: getArr(data.ferias?.forma_pagamento_13),
    ferias_percentual_adiantamento_13: getStr(data.ferias?.percentual_adiantamento_13),
    ferias_antecipa_ferias: getStr(data.ferias?.antecipa_ferias),
    ferias_abate_faltas: getStr(data.ferias?.abate_faltas),
    tipos_pagamento: getArr(data.dados_bancarios?.tipos_pagamento),
    modelo_arquivo_obs: getStr(data.dados_bancarios?.modelo_arquivo_obs),
    tomadores_servico: getStr(data.tomadores_servico),
    autonomos_tem: getStr(data.autonomos?.tem_autonomos),
    autonomos_processo_rpa: getStr(data.autonomos?.processo_rpa),
    estagiarios_tem: getStr(data.estagiarios?.tem_estagiarios),
    estagiarios_paga_bolsa: getStr(data.estagiarios?.paga_bolsa),
    estagiarios_recesso_30_dias: getStr(data.estagiarios?.recesso_30_dias),
    estagiarios_paga_13: getStr(data.estagiarios?.paga_13),
    estagiarios_paga_recesso_proporcional: getStr(data.estagiarios?.paga_recesso_proporcional),
    estagiarios_observacoes: getStr(data.estagiarios?.observacoes),
    data_gatilho: getStr(lastGatilho.data),
    motivo_gatilho: getStr(lastGatilho.motivo),
    descricao_gatilho: getStr(lastGatilho.descricao),
    termo_local_data: getStr(data.termo_local_data),
    termo_responsavel: getStr(data.responsavel_preenchimento),
    termo_analista: getStr(data.analista_responsavel),
    termo_coordenacao: getStr(data.coordenacao)
  };
}

async function salvarParticularidade() {
  prepareFormForSaving();
  const data = getFormData();
  restoreFormAfterSaving();
  const form = document.getElementById('form');
  
  try {
    // Salva a empresa via API
    await fetchAPI('salvar_empresa', 'POST', data);
    
    alert('Particularidade salva com sucesso no banco de dados!');
    delete form.dataset.editId;
    voltarHome();
  } catch (err) {
    alert("Erro ao salvar: " + err.message);
  }
}

async function excluirEmpresa(id) {
  if (confirm('Tem certeza que deseja excluir esta empresa permanentemente do banco de dados?')) {
    try {
      await fetchAPI('excluir_empresa&id=' + id, 'DELETE');
      renderListaEmpresas();
    } catch (err) {
      alert("Erro ao excluir: " + err.message);
    }
  }
}

async function exportarSalva(id, formato) {
  try {
    const d = await fetchAPI('obter_empresa&id=' + id);
    if (d) {
      if (formato === 'xlsx') exportExcel(d);
      else exportPDF(d);
    }
  } catch (err) {
    console.error("Erro ao exportar:", err);
  }
}

async function renderListaEmpresas() {
  const wrap = document.getElementById('lista_empresas');
  if (!wrap) return;
  wrap.innerHTML = '<p class="muted">Carregando empresas...</p>';
  
  try {
    const empresas = await fetchAPI('listar_empresas');
    wrap.innerHTML = '';
    
    if (Object.keys(empresas).length === 0) {
      wrap.innerHTML = '<p class="muted">Nenhuma empresa salva ainda.</p>';
      return;
    }

    const searchInput = document.getElementById('search_empresa');
    const term = searchInput ? searchInput.value.toLowerCase() : '';

    let countRendered = 0;

    // A API retorna um array de objetos de dados da empresa
    empresas.forEach(d => {
      const nome = d.empresa.nome_social || d.empresa.razao_social_matriz || 'Empresa sem nome';
      const cnpj = d.empresa.cnpj_matriz || 'Sem CNPJ';
      const id = d.empresa.cnpj_matriz ? d.empresa.cnpj_matriz.replace(/\D/g, '') : '';
      const analista = d.analista_responsavel || '';

      if (term) {
        if (!nome.toLowerCase().includes(term) && !cnpj.toLowerCase().includes(term) && !analista.toLowerCase().includes(term)) {
          return;
        }
      }

      countRendered++;
      const safeNome = nome.replace(/'/g, "\\'");

      const card = document.createElement('div');
      card.className = 'card';
      card.style.margin = '0';

      // Gatilhos e incidências agora virão da API no "verEmpresa"
      card.innerHTML = `
        <h3 style="margin-top:0">${nome}</h3>
        <p class="muted" style="margin-bottom:4px">CNPJ: ${cnpj}</p>
        <p class="muted" style="margin-top:0; font-size:0.85em;">Analista: <span style="color:var(--accent1)">${analista || 'Não informado'}</span></p>
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:16px;">
          <button class="btn-primary" style="margin-top:0; padding: 10px 16px;" onclick="verEmpresa('${id}')">Ver / Editar</button>
          <button class="btn-outline" style="margin-top:0;" onclick="exportarSalva('${id}', 'pdf')">PDF</button>
          <button class="btn-outline" style="margin-top:0;" onclick="abrirChecklist('${id}', '${safeNome}')">Checklist</button>
          <button class="btn-outline" style="margin-top:0; border-color:#eab308; color:#eab308;" onclick="abrirIncidencias('${id}', '${safeNome}')">Incidências ⚠️</button>
          <button class="btn-outline" style="margin-top:0; border-color:var(--accent1); color:var(--accent1);" onclick="abrirModalGatilho('${id}', '${safeNome}')">+ Gatilho</button>
          <button class="btn-outline" style="margin-top:0; border-color:#ef4444; color:#ef4444;" onclick="excluirEmpresa('${id}')">Excluir</button>
        </div>
      `;
      wrap.appendChild(card);
    });

    if (countRendered === 0 && term) {
      wrap.innerHTML = '<p class="muted">Nenhuma empresa encontrada para a pesquisa.</p>';
    }
  } catch (err) {
    wrap.innerHTML = '<p class="muted" style="color:var(--accent1)">Erro ao carregar empresas do banco de dados.</p>';
  }
}

function filtrarEmpresas() {
  renderListaEmpresas();
}

function abrirModalGatilho(id, nome) {
  document.getElementById('modal_empresa_id').value = id;
  document.getElementById('modal_empresa_nome').textContent = "Empresa: " + nome;
  document.getElementById('modal_g_data').value = new Date().toISOString().split('T')[0];
  document.getElementById('modal_g_motivo').value = '';
  const textarea = document.getElementById('modal_g_descricao');
  textarea.value = '';
  textarea._pastedImages = {};
  if (typeof updatePreviews === 'function') updatePreviews(textarea);

  const modal = document.getElementById('modal_gatilho');
  modal.style.display = 'flex';
}

async function toggleChecklistItem(type, index) {
  const id = document.getElementById('checklist_empresa_id').value;
  try {
    const d = await fetchAPI('obter_checklist&empresa_id=' + id);
    if (!d || !d[type] || !d[type][index]) return;
    
    d[type][index].checked = !d[type][index].checked;
    
    await fetchAPI('salvar_checklist', 'POST', {
      empresa_id: id,
      sugestao_raw: d.sugestao_raw,
      criterios_raw: d.criterios_raw,
      sugestoes: d.sugestoes,
      criterios: d.criterios
    });
    
    renderChecklistCards(id);
  } catch (err) { console.error(err); }
}

async function renderChecklistCards(id) {
  try {
    const checklist = await fetchAPI('obter_checklist&empresa_id=' + id);
    const wrap = document.getElementById('checklist_cards');
    wrap.innerHTML = '';
    
    if (!checklist || (!checklist.sugestoes?.length && !checklist.criterios?.length)) {
      wrap.innerHTML = '<p class="muted" style="margin-top:20px;">Nenhum item adicionado a este checklist.</p>';
      return;
    }
    
    const renderList = (title, type, items) => {
      if (!items || !items.length) return '';
      let html = `<h3 style="margin-bottom:12px; margin-top:24px;">${title}</h3><div class="chk-list" style="margin-bottom:24px;">`;
      items.forEach((item, idx) => {
        const cls = item.checked ? 'feito' : '';
        html += `
          <div class="chk-item ${cls}" onclick="toggleChecklistItem('${type}', ${idx})">
            <div class="chk-box">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <div class="chk-text">${item.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
            <div class="chk-badge">Feito</div>
          </div>
        `;
      });
      html += '</div>';
      return html;
    };
    
    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginTop = '0';
    card.innerHTML = `
      ${renderList('Sugestão de checklist de conferências', 'sugestoes', checklist.sugestoes)}
      ${renderList('Itens a analisar com critério maior', 'criterios', checklist.criterios)}
    `;
    wrap.appendChild(card);
  } catch (err) { console.error(err); }
}

async function abrirChecklist(id, nome) {
  document.getElementById('checklist_empresa_id').value = id;
  document.getElementById('checklist_empresa_nome').textContent = "Checklist: " + nome;
  
  try {
    const checklist = await fetchAPI('obter_checklist&empresa_id=' + id);
    
    if (checklist && (checklist.sugestoes?.length > 0 || checklist.criterios?.length > 0)) {
      document.getElementById('form_checklist').style.display = 'none';
      document.getElementById('checklist_cards').style.display = 'block';
      document.getElementById('btn_edit_checklist').style.display = 'inline-block';
      document.getElementById('btn_limpar_checklist').style.display = 'inline-block';
      renderChecklistCards(id);
    } else {
      document.getElementById('form_checklist').style.display = 'block';
      document.getElementById('checklist_cards').style.display = 'none';
      document.getElementById('btn_edit_checklist').style.display = 'none';
      document.getElementById('btn_limpar_checklist').style.display = 'none';
      
      document.getElementById('chk_sugestao').value = checklist?.sugestao_raw || '';
      document.getElementById('chk_criterios').value = checklist?.criterios_raw || '';
      if (typeof deserializeTextarea === 'function') {
        deserializeTextarea(document.getElementById('chk_sugestao'));
        deserializeTextarea(document.getElementById('chk_criterios'));
      }
    }

    document.getElementById('home_view').style.display = 'none';
    document.getElementById('form_view').style.display = 'none';
    document.getElementById('checklist_view').style.display = 'block';
  } catch (err) { console.error(err); }
}

function editarChecklist() {
  const id = document.getElementById('checklist_empresa_id').value;
  let salvas = JSON.parse(localStorage.getItem('empresas_srh') || '{}');
  const checklist = salvas[id]?.checklist;
  
  if (checklist) {
    document.getElementById('chk_sugestao').value = checklist.sugestao_raw || (checklist.sugestoes ? checklist.sugestoes.map(i => i.text).join('\n') : checklist.sugestao || '');
    document.getElementById('chk_criterios').value = checklist.criterios_raw || (checklist.criterios ? checklist.criterios.map(i => i.text).join('\n') : checklist.criterios || '');
    if (typeof deserializeTextarea === 'function') {
      deserializeTextarea(document.getElementById('chk_sugestao'));
      deserializeTextarea(document.getElementById('chk_criterios'));
    }
  }
  
  document.getElementById('form_checklist').style.display = 'block';
  document.getElementById('checklist_cards').style.display = 'none';
  document.getElementById('btn_edit_checklist').style.display = 'none';
  document.getElementById('btn_limpar_checklist').style.display = 'none';
}

async function salvarChecklist() {
  const id = document.getElementById('checklist_empresa_id').value;
  const sug_textarea = document.getElementById('chk_sugestao');
  const crit_textarea = document.getElementById('chk_criterios');
  const sug_raw = typeof serializeText === 'function' ? serializeText(sug_textarea) : sug_textarea.value;
  const crit_raw = typeof serializeText === 'function' ? serializeText(crit_textarea) : crit_textarea.value;

  try {
    const existing = await fetchAPI('obter_checklist&empresa_id=' + id);
    
    const parseList = (text, existingItems) => {
      return text.split('\n').map(t => t.trim()).filter(t => t).map(text => {
        const item = (existingItems || []).find(i => i.text === text);
        return { text, checked: item ? item.checked : false };
      });
    };

    const payload = {
      empresa_id: id,
      sugestao_raw: sug_raw,
      criterios_raw: crit_raw,
      sugestoes: parseList(sug_raw, existing?.sugestoes),
      criterios: parseList(crit_raw, existing?.criterios)
    };

    await fetchAPI('salvar_checklist', 'POST', payload);
    
    const toast = document.getElementById('checklist_toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
    
    document.getElementById('form_checklist').style.display = 'none';
    document.getElementById('checklist_cards').style.display = 'block';
    document.getElementById('btn_edit_checklist').style.display = 'inline-block';
    document.getElementById('btn_limpar_checklist').style.display = 'inline-block';
    renderChecklistCards(id);
  } catch (err) { console.error(err); }
}

async function limparChecklist() {
  if (!confirm('Deseja realmente desmarcar todos os itens deste checklist?')) return;
  const id = document.getElementById('checklist_empresa_id').value;
  try {
    await fetchAPI('limpar_checklist', 'POST', { empresa_id: id });
    renderChecklistCards(id);
  } catch (err) { console.error(err); }
}

function fecharModalGatilho() {
  document.getElementById('modal_gatilho').style.display = 'none';
}

async function salvarModalGatilho() {
  const id = document.getElementById('modal_empresa_id').value;
  const data = document.getElementById('modal_g_data').value;
  const motivo = document.getElementById('modal_g_motivo').value;
  const textarea = document.getElementById('modal_g_descricao');
  const descricao = typeof serializeText === 'function' ? serializeText(textarea) : textarea.value;

  if (!motivo || !descricao) {
    alert("Preencha o motivo e a descrição!");
    return;
  }

  try {
    await fetchAPI('salvar_gatilho', 'POST', {
      empresa_id: id,
      data,
      motivo,
      descricao
    });
    alert("Gatilho adicionado com sucesso!");
    fecharModalGatilho();
    renderListaEmpresas();
  } catch (err) {
    console.error(err);
  }
}

// ==== Incidências ====
function abrirIncidencias(id, nome) {
  document.getElementById('incidencias_empresa_id').value = id;
  document.getElementById('incidencias_empresa_nome').textContent = "Incidências ⚠️ - " + nome;
  
  // Reset form
  document.getElementById('inc_data').value = new Date().toISOString().split('T')[0];
  document.getElementById('inc_tipo').value = 'Erro';
  const textarea = document.getElementById('inc_descricao');
  textarea.value = '';
  textarea._pastedImages = {};
  if (typeof updatePreviews === 'function') updatePreviews(textarea);

  document.getElementById('btn_limpar_incidencias').style.display = 'inline-block';
  document.getElementById('btn_edit_incidencias').style.display = 'none'; // Not needed anymore
  
  renderIncidenciasCards(id);
  
  document.getElementById('home_view').style.display = 'none';
  document.getElementById('form_view').style.display = 'none';
  document.getElementById('checklist_view').style.display = 'none';
  document.getElementById('incidencias_view').style.display = 'block';
  window.scrollTo(0, 0);
}

async function adicionarIncidencia() {
  const id = document.getElementById('incidencias_empresa_id').value;
  const data = document.getElementById('inc_data').value;
  const tipo = document.getElementById('inc_tipo').value;
  const textarea = document.getElementById('inc_descricao');
  const descricao = typeof serializeText === 'function' ? serializeText(textarea).trim() : textarea.value.trim();
  
  if (!data || !descricao) {
    alert("Por favor, preencha a data e a descrição.");
    return;
  }
  
  try {
    await fetchAPI('salvar_incidencia', 'POST', {
      empresa_id: id,
      data: data.split('-').reverse().join('/'),
      tipo,
      descricao
    });
    textarea.value = '';
    textarea._pastedImages = {};
    if (typeof updatePreviews === 'function') updatePreviews(textarea);
    renderIncidenciasCards(id);
  } catch (err) { console.error(err); }
}

async function renderIncidenciasCards(id) {
  try {
    const incidencias = await fetchAPI('listar_incidencias&empresa_id=' + id);
    const wrap = document.getElementById('incidencias_cards');
    wrap.innerHTML = '';
    wrap.style.display = 'block';
    
    if (!incidencias || !incidencias.length) {
      wrap.innerHTML = '<p class="muted" style="margin-top:20px;">Nenhuma incidência registrada para este cliente.</p>';
      return;
    }
    
    let html = `<h3 style="margin-bottom:12px; margin-top:24px;">Histórico de Incidências</h3><div class="chk-list" style="margin-bottom:24px;">`;
    incidencias.forEach((item, idx) => {
      const cls = item.checked ? 'feito' : '';
      const safeDesc = (item.descricao || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const renderedDesc = typeof renderMarkdownImages === 'function' ? renderMarkdownImages(safeDesc) : safeDesc;
      html += `
        <div class="chk-item ${cls}" style="align-items: flex-start; padding: 16px;">
          <div class="chk-box" style="margin-top: 4px;" onclick="toggleIncidenciaItem(${item.id})">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div class="chk-text" style="flex-grow: 1;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span class="badge" style="background: var(--bg); color: var(--fg); padding: 2px 8px; border-radius: 4px; font-size: 0.75em; border: 1px solid var(--card-border);">${item.tipo}</span>
              <small style="color:var(--muted); font-size:0.85em;">${item.data}</small>
            </div>
            <div style="margin: 0; font-size: 0.95em; line-height: 1.4;">${renderedDesc}</div>
          </div>
          <button type="button" class="remove" style="padding: 4px 8px; font-size: 0.75em; margin: 0 0 0 12px;" onclick="removerIncidencia(${item.id})">Excluir</button>
        </div>
      `;
    });
    html += '</div>';
    wrap.innerHTML = html;
  } catch (err) { console.error(err); }
}

async function toggleIncidenciaItem(idInc) {
  const idEmp = document.getElementById('incidencias_empresa_id').value;
  try {
    // Busca incidências para saber o estado atual
    const incs = await fetchAPI('listar_incidencias&empresa_id=' + idEmp);
    const inc = incs.find(i => i.id == idInc);
    if (!inc) return;
    
    await fetchAPI('toggle_incidencia', 'POST', { id: idInc, checked: !inc.checked });
    renderIncidenciasCards(idEmp);
  } catch (err) { console.error(err); }
}

async function removerIncidencia(idInc) {
  if (confirm('Deseja excluir esta incidência?')) {
    const idEmp = document.getElementById('incidencias_empresa_id').value;
    try {
      await fetchAPI('excluir_incidencia&id=' + idInc, 'DELETE');
      renderIncidenciasCards(idEmp);
    } catch (err) { console.error(err); }
  }
}

async function limparIncidencias() {
  if (confirm('Deseja realmente limpar TODO o histórico de incidências desta empresa?')) {
    const idEmp = document.getElementById('incidencias_empresa_id').value;
    try {
      await fetchAPI('limpar_incidencias&empresa_id=' + idEmp, 'DELETE');
      renderIncidenciasCards(idEmp);
    } catch (err) { console.error(err); }
  }
}

// ==== inicialização ====
document.addEventListener('DOMContentLoaded', () => {
  renderListaEmpresas();

  // bind export
  const btnExp = document.getElementById('btnExportar');
  if (btnExp) {
    btnExp.addEventListener('click', () => {
      prepareFormForSaving();
      const d = getFormData();
      restoreFormAfterSaving();
      const fmt = document.getElementById('formato').value;
      if (fmt === 'xlsx') exportExcel(d);
      else exportPDF(d);
    });
  }

  // CNPJ matriz máscara/validação + consultas
  const el = document.getElementById('cnpj_matriz'); const hint = document.getElementById('cnpj_hint'); const razao = document.querySelector('[name="razao_social_matriz"]'); const simples = document.querySelector('[name="simples_nacional"]');
  if (el) { el.addEventListener('input', () => { el.value = maskCpfCnpj(el.value); }); el.addEventListener('blur', async () => { const d = onlyDigits(el.value); const isCpf = d.length <= 11; const ok = isCpf ? isValidCPF(d) : isValidCNPJ(d); hint.textContent = ok ? (isCpf ? 'CPF válido.' : 'CNPJ válido.') : (isCpf ? 'CPF inválido.' : 'CNPJ inválido.'); hint.style.color = ok ? '#9fe2bf' : '#ffb4b4'; if (!ok || isCpf) return; try { const b = await fetchCNPJ_BrasilAPI(d); if (b?.razao_social && razao) razao.value = b.razao_social; } catch (e) { } try { const r = await fetchSimples_ReceitaWS(d); if (r?.simples && typeof r.simples.optante === 'boolean' && simples) simples.value = r.simples.optante ? 'Sim' : 'Não'; } catch (e) { } }); }
});


// ==== Upload de Anexos ====
/**
 * Faz upload de uma imagem em base64 para o servidor.
 * Retorna a URL relativa do arquivo salvo (ex: 'anexos/abc123.png').
 */
async function uploadAnexo(base64, mimeType, empresaId = null, origem = null, origemId = null) {
  try {
    const res = await fetch(`${API_URL}?action=salvar_anexo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64_data: base64,
        mime_type: mimeType,
        empresa_id: empresaId,
        origem: origem,
        origem_id: origemId
      })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erro ao salvar anexo');
    return json.data.url; // ex: 'anexos/abc123.png'
  } catch (err) {
    console.error('Erro ao fazer upload do anexo:', err);
    return null; // fallback: mantém base64 local
  }
}

/** Obtém o empresa_id atual do formulário aberto (se houver). */
function getCurrentEmpresaId() {
  const form = document.getElementById('form');
  return form ? (form.dataset.editId || null) : null;
}

// ==== Funções auxiliares para colagem de prints em textareas ====

function serializeText(textarea) {
  if (!textarea) return '';
  let text = textarea.value;
  if (!textarea._pastedImages) return text;
  
  for (const id in textarea._pastedImages) {
    const tag = `[${id}]`;
    const base64 = textarea._pastedImages[id];
    if (text.includes(tag)) {
      text = text.replace(new RegExp('\\[' + id + '\\]', 'g'), `![print](${base64})`);
    }
  }
  return text;
}

function deserializeTextarea(textarea) {
  if (!textarea) return;
  let text = textarea.value || '';
  textarea._pastedImages = {};
  
  let count = 0;
  const regex = /!\[print\]\((data:image\/[a-zA-Z+.-]+;base64,[a-zA-Z0-9+/=]+)\)/g;
  
  text = text.replace(regex, (match, base64) => {
    const id = 'print_' + Date.now() + '_' + count + '_' + Math.random().toString(36).substr(2, 5);
    textarea._pastedImages[id] = base64;
    count++;
    return `[${id}]`;
  });
  
  textarea.value = text;
  updatePreviews(textarea);
}

function updatePreviews(textarea) {
  let container = textarea.nextElementSibling;
  if (!container || !container.classList.contains('image-previews-container')) {
    container = document.createElement('div');
    container.className = 'image-previews-container';
    textarea.after(container);
  }
  
  container.innerHTML = '';
  const text = textarea.value;

  // ── 1. Placeholders [print_xxx] → imagem base64 em memória (upload em andamento ou fallback) ──
  const placeholderMatches = text.match(/\[print_[a-zA-Z0-9_]+\]/g) || [];

  if (textarea._pastedImages) {
    for (const id in textarea._pastedImages) {
      if (!placeholderMatches.includes(`[${id}]`)) {
        delete textarea._pastedImages[id];
      }
    }
  }

  placeholderMatches.forEach(match => {
    const id = match.slice(1, -1);
    const base64 = textarea._pastedImages ? textarea._pastedImages[id] : null;
    if (base64) {
      const wrapper = document.createElement('div');
      wrapper.className = 'image-preview-wrapper';

      const loading = document.createElement('span');
      loading.style.cssText = 'font-size:0.75em; color:var(--muted); display:block; margin-bottom:4px;';
      loading.textContent = '⏳ Enviando para o servidor...';

      const img = document.createElement('img');
      img.src = base64;
      img.alt = 'Print';
      img.title = 'Clique para ver em tamanho real';
      img.onclick = () => {
        const win = window.open();
        if (win) win.document.write(`<img src="${base64}" style="max-width:100%; height:auto;" />`);
      };

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-btn';
      removeBtn.innerHTML = '&times;';
      removeBtn.onclick = () => {
        textarea.value = textarea.value.replace(match, '');
        updatePreviews(textarea);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      };

      wrapper.appendChild(loading);
      wrapper.appendChild(img);
      wrapper.appendChild(removeBtn);
      container.appendChild(wrapper);
    }
  });

  // ── 2. ![print](url-do-servidor) → imagem salva no servidor ──
  const serverRegex = /!\[print\]\(((?!data:)[^)]+)\)/g;
  let serverMatch;
  while ((serverMatch = serverRegex.exec(text)) !== null) {
    const fullMatch = serverMatch[0];
    const url = serverMatch[1];

    const wrapper = document.createElement('div');
    wrapper.className = 'image-preview-wrapper';

    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Print';
    img.title = 'Clique para ver em tamanho real';
    img.onclick = () => {
      const win = window.open();
      if (win) win.document.write(`<img src="${url}" style="max-width:100%; height:auto;" />`);
    };

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '&times;';
    removeBtn.onclick = () => {
      textarea.value = textarea.value.replace(fullMatch, '');
      updatePreviews(textarea);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    };

    wrapper.appendChild(img);
    wrapper.appendChild(removeBtn);
    container.appendChild(wrapper);
  }
}

function prepareFormForSaving() {
  const textareas = document.querySelectorAll('#form textarea');
  textareas.forEach(textarea => {
    if (textarea._pastedImages && Object.keys(textarea._pastedImages).length > 0) {
      textarea._originalValueForSaving = textarea.value;
      textarea.value = serializeText(textarea);
    }
  });
}

function restoreFormAfterSaving() {
  const textareas = document.querySelectorAll('#form textarea');
  textareas.forEach(textarea => {
    if (textarea._originalValueForSaving !== undefined) {
      textarea.value = textarea._originalValueForSaving;
      delete textarea._originalValueForSaving;
    }
  });
}

function deserializeAll() {
  const textareas = document.querySelectorAll('#form textarea');
  textareas.forEach(textarea => {
    deserializeTextarea(textarea);
  });
}

function renderMarkdownImages(text) {
  if (!text) return '';

  // Renderiza imagens base64 (legacy / fallback offline)
  text = text.replace(/!\[print\]\((data:image\/[a-zA-Z+.-]+;base64,[a-zA-Z0-9+/=]+)\)/g, (match, base64) => {
    return `<div class="image-preview-wrapper" style="display:inline-block; margin: 4px; vertical-align: top;"><img src="${base64}" alt="Print" style="max-width:100%; height:auto; cursor:pointer;" onclick="const win=window.open();if(win)win.document.write('<img src=&quot;'+this.src+'&quot; style=&quot;max-width:100%;&quot;/>')" /></div>`;
  });

  // Renderiza imagens salvas no servidor (URL relativa ou absoluta, ex: anexos/xxx.png)
  text = text.replace(/!\[print\]\(((?!data:)[^)]+)\)/g, (match, url) => {
    return `<div class="image-preview-wrapper" style="display:inline-block; margin: 4px; vertical-align: top;"><img src="${url}" alt="Print" style="max-width:100%; height:auto; cursor:pointer;" onclick="const win=window.open();if(win)win.document.write('<img src=&quot;'+this.src+'&quot; style=&quot;max-width:100%;&quot;/>')" /></div>`;
  });

  return text;
}

// Global Event Listeners
document.addEventListener('paste', function(e) {
  const textarea = e.target;
  if (textarea && textarea.tagName === 'TEXTAREA') {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    let imagePasted = false;
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        imagePasted = true;
        const mimeType = item.type;
        const file = item.getAsFile();
        const reader = new FileReader();
        reader.onload = async function(event) {
          const base64 = event.target.result;
          const placeholderId = 'print_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
          const tag = `[${placeholderId}]`;

          // Insere placeholder temporário enquanto faz upload
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const text = textarea.value;
          textarea.value = text.substring(0, start) + tag + text.substring(end);
          if (!textarea._pastedImages) textarea._pastedImages = {};
          textarea._pastedImages[placeholderId] = base64; // mantém base64 localmente como fallback
          updatePreviews(textarea);
          textarea.dispatchEvent(new Event('input', { bubbles: true }));

          // Faz upload para o servidor
          const empresaId = getCurrentEmpresaId();
          const serverUrl = await uploadAnexo(base64, mimeType, empresaId, 'texto', null);

          if (serverUrl) {
            // Substitui o placeholder pelo markdown com URL do servidor
            const markdownImg = `![print](${serverUrl})`;
            textarea.value = textarea.value.replace(tag, markdownImg);
            // Remove do cache local pois agora é uma URL real
            delete textarea._pastedImages[placeholderId];
            updatePreviews(textarea);
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
          }
          // Se upload falhar, o base64 local permanece como fallback
        };
        reader.readAsDataURL(file);
      }
    }
    if (imagePasted) {
      e.preventDefault();
    }
  }
});

document.addEventListener('input', function(e) {
  const textarea = e.target;
  if (textarea && textarea.tagName === 'TEXTAREA') {
    updatePreviews(textarea);
  }
});
