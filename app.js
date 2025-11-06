// JurisTST - Sistema Inteligente de Busca de Jurisprudência
// Desenvolvido para Renata - Assessoria Judicial TRT12
// Versão 3.1 - FASE 1: Correções Críticas

// ========== GERENCIADOR CENTRAL DE IDs ==========
// ✅ CORREÇÃO 1: IDs sempre consistentes em todo o sistema

/**
 * Gera ID consistente para qualquer tipo de item
 * @param {string} tipo - 'sumula', 'oj', 'precedente', 'informativo', 'tese'
 * @param {string|number} identificador - número ou tema da tese
 * @returns {string} ID padronizado
 */
function gerarIdConsistente(tipo, identificador) {
    // Remove espaços e caracteres especiais do identificador
    const idLimpo = String(identificador).trim().replace(/[^a-zA-Z0-9]/g, '');
    
    switch(tipo.toLowerCase()) {
        case 'sumula':
            return `sumula_${idLimpo}`;
        case 'oj':
            return `oj_${idLimpo}`;
        case 'precedente':
        case 'precedente_normativo':
            return `precedente_${idLimpo}`;
        case 'informativo':
            return `informativo_${idLimpo}`;
        case 'tese':
        case 'irr':
        case 'irdr':
        case 'iac':
            return `tese-${idLimpo}`;
        default:
            console.warn(`⚠️ Tipo desconhecido: ${tipo}, usando genérico`);
            return `${tipo}_${idLimpo}`;
    }
}

// ========== NORMALIZAÇÃO DE TEXTO PARA BUSCA ==========
// ✅ CORREÇÃO 2: Busca funciona sem acentuação

/**
 * Remove acentos e converte para lowercase para busca
 * @param {string} texto - Texto a ser normalizado
 * @returns {string} Texto normalizado
 */
function normalizarTexto(texto) {
    if (!texto) return '';
    
    return texto
        .toLowerCase()
        .normalize('NFD') // Decompõe caracteres acentuados
        .replace(/[\u0300-\u036f]/g, '') // Remove marcas diacríticas
        .trim();
}

/**
 * Verifica se um texto contém um termo de busca (ambos normalizados)
 * @param {string} textoCompleto - Texto onde buscar
 * @param {string} termoBusca - Termo a ser buscado
 * @returns {boolean}
 */
function contemTermoNormalizado(textoCompleto, termoBusca) {
    if (!textoCompleto || !termoBusca) return false;
    
    const textoNormalizado = normalizarTexto(textoCompleto);
    const termoNormalizado = normalizarTexto(termoBusca);
    
    return textoNormalizado.includes(termoNormalizado);
}

// ========== ESTRUTURA DE DADOS ==========
let dadosTST = {
    sumulas: [],
    ojs: [],
    precedentes: []
};

let todosItens = [];
let itensFiltrados = [];
let favoritos = [];
let anotacoes = {}; // {itemId: "texto da anotação"}
let tags = {}; // {itemId: ["tag1", "tag2"]}
let correlacoes = {}; // {itemId: [relatedItemIds]}
let informativos = [];
let tesesVinculantes = [];

let viewMode = 'grid';
let searchTerm = '';
let statusFiltro = 'todos';
let currentTab = 'jurisprudencia';
let currentModalItem = null;

// Estatísticas
let stats = {
    total: 0,
    vigentes: 0,
    canceladas: 0
};

// ========== INICIALIZAÇÃO ==========
function carregarDados() {
    // Carregar dados salvos do localStorage
    const favoritosSalvos = localStorage.getItem('juristst_favoritos');
    if (favoritosSalvos) {
        favoritos = JSON.parse(favoritosSalvos);
    }
    
    const anotacoesSalvas = localStorage.getItem('juristst_anotacoes');
    if (anotacoesSalvas) {
        anotacoes = JSON.parse(anotacoesSalvas);
    }
    
    const tagsSalvas = localStorage.getItem('juristst_tags');
    if (tagsSalvas) {
        tags = JSON.parse(tagsSalvas);
    }
    
    const correlacoesSalvas = localStorage.getItem('juristst_correlacoes');
    if (correlacoesSalvas) {
        correlacoes = JSON.parse(correlacoesSalvas);
    }
    
    const informativosSalvos = localStorage.getItem('juristst_informativos');
    if (informativosSalvos) {
        informativos = JSON.parse(informativosSalvos);
    }
    
    const tesesSalvas = localStorage.getItem('juristst_teses');
    if (tesesSalvas) {
        tesesVinculantes = JSON.parse(tesesSalvas);
    }
    
    // Carregar dados da jurisprudência
    carregarJurisprudencia();
}

async function carregarJurisprudencia() {
    try {
        // PRIORIDADE 1: Tentar carregar do localStorage (dados atualizados via admin)
        const dadosLocais = localStorage.getItem('juristst_data');
        if (dadosLocais) {
            try {
                dadosTST = JSON.parse(dadosLocais);
                console.log('✅ Dados carregados do localStorage (atualizados via admin)');
                console.log('📊 Dados carregados:', dadosTST);
                
                // Processar dados do localStorage
                processarDadosCarregados();
                return;
            } catch (error) {
                console.warn('⚠️ Erro nos dados locais, carregando do JSON...', error);
                localStorage.removeItem('juristst_data'); // Limpar dados corrompidos
            }
        }
        
        // PRIORIDADE 2: Carregar do JSON no GitHub (fallback)
        console.log('🔄 Carregando do JSON no GitHub...');
        const response = await fetch('tst_data_complete.json');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        dadosTST = await response.json();
        console.log('📊 JSON carregado do GitHub:', dadosTST);
        
        processarDadosCarregados();
    } catch (error) {
        console.error('❌ Erro ao carregar jurisprudência:', error);
        mostrarToast('Erro ao carregar dados da jurisprudência', 'error');
    }
}

function processarDadosCarregados() {
    try {
        // Validar estrutura do JSON
        if (!dadosTST || typeof dadosTST !== 'object') {
            throw new Error('JSON inválido: não é um objeto');
        }
        
        // Garantir que os arrays existam
        dadosTST.sumulas = Array.isArray(dadosTST.sumulas) ? dadosTST.sumulas : [];
        
        // OJs é um dicionário com subgrupos, precisamos combinar todos
        let ojsArray = [];
        if (dadosTST.ojs && typeof dadosTST.ojs === 'object') {
            // Iterar sobre cada subgrupo de OJs
            for (const [orgao, ojs] of Object.entries(dadosTST.ojs)) {
                if (Array.isArray(ojs)) {
                    console.log(`📋 Processando OJs do órgão: ${orgao} (${ojs.length} itens)`);
                    
                    // Transformar nome do órgão para formato padronizado
                    let orgaoFormatado = orgao.toUpperCase();
                    
                    // Adicionar hífen após SBDI
                    if (orgaoFormatado.includes('SBDI')) {
                        orgaoFormatado = orgaoFormatado
                            .replace('SBDI1_', 'SBDI-1-')
                            .replace('SBDI2_', 'SBDI-2-')
                            .replace('SBDI1', 'SBDI-1')
                            .replace('SBDI2', 'SBDI-2');
                    }
                    
                    // Substituir underscores por hífens
                    orgaoFormatado = orgaoFormatado.replace(/_/g, '-');
                    
                    console.log(`   ➜ Órgão formatado: "${orgao}" → "${orgaoFormatado}"`);
                    
                    // Adicionar informação do órgão a cada OJ
                    const ojsComOrgao = ojs.map(oj => ({
                        ...oj,
                        orgao: orgaoFormatado
                    }));
                    ojsArray = ojsArray.concat(ojsComOrgao);
                }
            }
        }
        dadosTST.ojs = ojsArray;
        
        // Precedentes Normativos
        dadosTST.precedentes = Array.isArray(dadosTST.precedentes_normativos) ? 
            dadosTST.precedentes_normativos : [];
        
        console.log(`📚 Súmulas: ${dadosTST.sumulas.length}`);
        console.log(`📋 OJs: ${dadosTST.ojs.length}`);
        console.log(`⚖️ Precedentes: ${dadosTST.precedentes.length}`);
        
        // Combinar todos os itens em um array único
        // ✅ USANDO GERENCIADOR DE IDs
        todosItens = [
            ...dadosTST.sumulas.map(item => ({
                ...item,
                tipo: item.tipo || 'sumula',
                id: gerarIdConsistente('sumula', item.numero),
                source: 'jurisprudencia'
            })),
            ...dadosTST.ojs.map(item => ({
                ...item,
                tipo: item.tipo || 'oj',
                id: gerarIdConsistente('oj', item.numero),
                source: 'jurisprudencia'
            })),
            ...dadosTST.precedentes.map(item => ({
                ...item,
                tipo: item.tipo || 'precedente',
                id: gerarIdConsistente('precedente', item.numero),
                source: 'jurisprudencia'
            }))
        ];
        
        console.log(`📦 Total de itens combinados: ${todosItens.length}`);
        
        // Adicionar informativos e teses ao array geral
        informativos.forEach((info, index) => {
            todosItens.push({
                ...info,
                id: info.id || gerarIdConsistente('informativo', index),
                tipo: 'informativo',
                source: 'informativo'
            });
        });
        
        tesesVinculantes.forEach((tese) => {
            // ✅ USAR ID EXISTENTE (do localStorage) OU GERAR NOVO
            const teseId = tese.id || gerarIdConsistente('tese', tese.tema);
            
            const teseComId = {
                ...tese,
                id: teseId,
                source: 'tese',
                tipo: tese.tipo || 'IRR'
            };
            
            todosItens.push(teseComId);
            console.log('📌 Tese adicionada ao todosItens:', teseId, '| Source:', teseComId.source, '| Tipo:', teseComId.tipo, '| Tema:', tese.tema);
        });
        
        calcularEstatisticas();
        itensFiltrados = todosItens.filter(item => item.source === 'jurisprudencia');
        renderizarResultados();
        
        console.log('✅ Processamento concluído com sucesso');
    } catch (error) {
        console.error('❌ Erro no processamento:', error);
        mostrarToast('Erro ao processar dados', 'error');
    }
}

// ========== NAVEGAÇÃO ENTRE ABAS ==========
function switchTab(tabName, buttonElement) {
    try {
        console.log('🔄 Iniciando mudança de aba para:', tabName);
        
        // Esconder todas as abas
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Remover active de todos os botões
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Mostrar aba selecionada
        const tabElement = document.getElementById(tabName);
        if (tabElement) {
            tabElement.classList.add('active');
            console.log('✅ Aba ativada:', tabName);
        } else {
            console.error('❌ Aba não encontrada:', tabName);
        }
        
        // Ativar botão correspondente
        if (buttonElement) {
            buttonElement.classList.add('active');
            console.log('✅ Botão ativado');
        } else {
            console.warn('⚠️ Botão não fornecido');
        }
        
        currentTab = tabName;
        
        // Renderizar conteúdo específico da aba
        try {
            if (tabName === 'favoritos') {
                console.log('📋 Renderizando favoritos...');
                renderizarFavoritos();
            } else if (tabName === 'informativos') {
                console.log('📋 Renderizando informativos...');
                renderizarInformativos();
            } else if (tabName === 'teses') {
                console.log('📋 Renderizando teses...');
                filtrarTeses();
            }
            console.log('✅ Renderização concluída');
        } catch (renderError) {
            console.error('❌ Erro ao renderizar conteúdo:', renderError);
            console.error('Stack:', renderError.stack);
        }
        
    } catch (error) {
        console.error('❌ ERRO CRÍTICO em switchTab:', error);
        console.error('Stack completo:', error.stack);
    }
}

// ========== CÁLCULO DE ESTATÍSTICAS ==========
function calcularEstatisticas() {
    const jurisprudenciaItems = todosItens.filter(item => item.source === 'jurisprudencia');
    stats.total = jurisprudenciaItems.length;
    stats.vigentes = jurisprudenciaItems.filter(item => !item.cancelada).length;
    stats.canceladas = jurisprudenciaItems.filter(item => item.cancelada).length;
    
    // Atualizar interface
    document.getElementById('totalCount').textContent = stats.total;
    document.getElementById('vigentesCount').textContent = stats.vigentes;
    document.getElementById('canceladasCount').textContent = stats.canceladas;
}

// ========== BUSCA E FILTROS ==========
// ✅ CORREÇÃO 2: Busca com normalização de texto
function realizarBusca() {
    searchTerm = document.getElementById('searchInput').value.trim();
    const tipoFiltro = document.getElementById('filterTipo').value;
    const orgaoFiltro = document.getElementById('filterOrgao').value;
    const numeroFiltro = document.getElementById('filterNumero').value.trim();
    const tagsFiltro = document.getElementById('filterTags').value.trim();
    
    // Normalizar termo de busca
    const searchTermNormalizado = normalizarTexto(searchTerm);
    
    let itensParaFiltrar;
    
    if (currentTab === 'jurisprudencia') {
        itensParaFiltrar = todosItens.filter(item => item.source === 'jurisprudencia');
    } else if (searchTermNormalizado) {
        // Se há busca, procurar em TODOS os itens
        itensParaFiltrar = todosItens;
        console.log(`🔍 Buscando "${searchTerm}" em ${todosItens.length} itens (incluindo PDFs)`);
    } else {
        itensParaFiltrar = todosItens.filter(item => item.source === 'jurisprudencia');
    }
    
    itensFiltrados = itensParaFiltrar.filter(item => {
        // Filtro de status (canceladas/vigentes)
        if (statusFiltro === 'vigentes' && item.cancelada) return false;
        if (statusFiltro === 'canceladas' && !item.cancelada) return false;
        
        // Filtro de tipo
        const tipoMap = {
            'sumula': 'Súmula',
            'oj': 'OJ',
            'precedente': 'Precedente Normativo'
        };
        const tipoDisplay = tipoMap[item.tipo] || item.tipo;
        if (tipoFiltro !== 'todos' && tipoDisplay !== tipoFiltro) return false;
        
        // Filtro de órgão (apenas para OJs)
        if (orgaoFiltro !== 'todos' && item.tipo === 'oj') {
            const orgaoItem = (item.orgao || '').toUpperCase();
            const orgaoFiltroUpper = orgaoFiltro.toUpperCase();
            
            if (!orgaoItem.includes(orgaoFiltroUpper)) {
                return false;
            }
        }
        
        // Filtro de número
        if (numeroFiltro && item.numero !== numeroFiltro) return false;
        
        // Filtro de tags (normalizado)
        if (tagsFiltro) {
            const itemTags = tags[item.id] || [];
            const filterTagsArray = tagsFiltro.split(',').map(t => t.trim());
            const hasAllTags = filterTagsArray.every(filterTag => 
                itemTags.some(itemTag => contemTermoNormalizado(itemTag, filterTag))
            );
            if (!hasAllTags) return false;
        }
        
        // Busca textual (NORMALIZADA)
        if (searchTermNormalizado) {
            const textoCompleto = `${item.numero} ${item.titulo || ''} ${item.texto || ''} ${item.textoExtraido || ''}`;
            const anotacao = anotacoes[item.id] || '';
            const textoComAnotacao = textoCompleto + ' ' + anotacao;
            
            const termos = searchTerm.split(' ').filter(t => t.length > 2);
            
            // Todos os termos devem estar presentes (busca normalizada)
            return termos.every(termo => contemTermoNormalizado(textoComAnotacao, termo));
        }
        
        return true;
    });
    
    renderizarResultados();
}

function filtrarPorStatus() {
    const statusRadios = document.getElementsByName('status');
    for (const radio of statusRadios) {
        if (radio.checked) {
            statusFiltro = radio.value;
            break;
        }
    }
    realizarBusca();
}

// ========== RENDERIZAÇÃO DE RESULTADOS ==========
function renderizarResultados() {
    const content = document.querySelector('#jurisprudencia .content');
    const resultCount = document.getElementById('resultCount');
    
    resultCount.textContent = itensFiltrados.length;
    
    if (itensFiltrados.length === 0) {
        content.innerHTML = `
            <div class="empty-state">
                <h3>🔍 Nenhum resultado encontrado</h3>
                <p>Tente ajustar os filtros ou termos de busca</p>
            </div>
        `;
        return;
    }
    
    const containerClass = viewMode === 'grid' ? 'results-grid' : 'results-list';
    let html = `<div class="${containerClass}">`;
    
    itensFiltrados.forEach(item => {
        html += criarCardHTML(item);
    });
    
    html += '</div>';
    content.innerHTML = html;
}

function criarCardHTML(item) {
    const tipo = item.tipo || 'sumula';
    const tipoMap = {
        'sumula': { display: 'Súmula', badge: 'badge-sumula' },
        'oj': { display: 'OJ', badge: 'badge-oj' },
        'precedente': { display: 'Precedente Normativo', badge: 'badge-precedente' },
        'informativo': { display: 'Informativo', badge: 'badge-informativo' },
        'irr': { display: 'IRR', badge: 'badge-irr' },
        'irdr': { display: 'IRDR', badge: 'badge-irdr' },
        'iac': { display: 'IAC', badge: 'badge-iac' }
    };
    
    const tipoInfo = tipoMap[tipo.toLowerCase()] || { display: tipo, badge: 'badge-sumula' };
    
    const isFavorito = favoritos.includes(item.id);
    const favoritoClass = isFavorito ? 'active' : '';
    const favoritoIcon = isFavorito ? '⭐' : '☆';
    
    const hasAnotacao = anotacoes[item.id] && anotacoes[item.id].trim() !== '';
    const itemTags = tags[item.id] || [];
    const linkedItems = correlacoes[item.id] || [];
    
    const orgaoInfo = item.orgao ? ` - ${item.orgao}` : '';
    const canceladoClass = item.cancelada ? 'cancelado' : '';
    
    // ✅ CORREÇÃO: Suportar tanto jurisprudência quanto teses
    let tituloExibido = '';
    let textoExibido = '';
    let numeroExibido = '';
    
    // Identificar se é tese ou jurisprudência
    if (item.source === 'tese' || item.tema) {
        // É uma tese vinculante
        numeroExibido = `Tema ${item.tema}`;
        tituloExibido = item.numero_processo || 'Sem processo';
        textoExibido = (item.tese || 'Sem tese disponível').substring(0, 200) + '...';
    } else {
        // É jurisprudência (súmula, OJ, precedente) ou informativo
        numeroExibido = item.numero || item.nome || 'N/A';
        tituloExibido = item.titulo || '';
        textoExibido = (item.texto || '').substring(0, 200) + '...';
    }
    
    if (searchTerm) {
        const termos = searchTerm.split(' ').filter(t => t.length > 2);
        termos.forEach(termo => {
            const regex = new RegExp(`(${termo})`, 'gi');
            tituloExibido = tituloExibido.replace(regex, '<span class="highlight">$1</span>');
            textoExibido = textoExibido.replace(regex, '<span class="highlight">$1</span>');
        });
    }
    
    return `
        <div class="card ${canceladoClass}" onclick="abrirDetalhes('${item.id}')">
            <div class="card-header">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="card-number">#${numeroExibido}</div>
                    ${item.cancelada ? '<span class="canceled-badge">❌ CANCELADA</span>' : ''}
                </div>
                <div class="card-badges">
                    <div class="card-badge ${tipoInfo.badge}">${tipoInfo.display}${orgaoInfo}</div>
                </div>
            </div>
            
            ${hasAnotacao || linkedItems.length > 0 ? `
                <div class="card-indicators">
                    ${hasAnotacao ? '<div class="indicator indicator-note">📝 Anotação</div>' : ''}
                    ${linkedItems.length > 0 ? `<div class="indicator indicator-linked">🔗 ${linkedItems.length} correlações</div>` : ''}
                </div>
            ` : ''}
            
            <div class="card-title">${tituloExibido}</div>
            <div class="card-preview">${textoExibido}</div>
            
            ${itemTags.length > 0 ? `
                <div class="card-tags">
                    ${itemTags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            ` : ''}
            
            ${item.cancelada && item.referencia ? `
                <div style="margin-top: 10px; color: var(--danger); font-size: 0.85em;">
                    📅 ${item.referencia}
                </div>
            ` : ''}
            
            <div class="card-footer">
                <div class="card-actions">
                    <button class="card-action favorite ${favoritoClass}" 
                            onclick="event.stopPropagation(); toggleFavorito('${item.id}')" 
                            title="Favoritar">
                        ${favoritoIcon}
                    </button>
                    <button class="card-action" 
                            onclick="event.stopPropagation(); abrirModalAnotacao('${item.id}')" 
                            title="Adicionar anotação">
                        📝
                    </button>
                    <button class="card-action" 
                            onclick="event.stopPropagation(); copiarItem('${item.id}')" 
                            title="Copiar texto">
                        📋
                    </button>
                    <button class="card-action" 
                            onclick="event.stopPropagation(); compartilharItem('${item.id}')" 
                            title="Compartilhar">
                        🔗
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ========== FAVORITOS ==========
function toggleFavorito(id) {
    const index = favoritos.indexOf(id);
    if (index > -1) {
        favoritos.splice(index, 1);
        mostrarToast('Removido dos favoritos', 'warning');
    } else {
        favoritos.push(id);
        mostrarToast('Adicionado aos favoritos', 'success');
    }
    
    localStorage.setItem('juristst_favoritos', JSON.stringify(favoritos));
    
    // ✅ Atualizar visualização de acordo com a aba ativa
    if (currentTab === 'jurisprudencia') {
        renderizarResultados();
    } else if (currentTab === 'favoritos') {
        renderizarFavoritos();
    } else if (currentTab === 'teses') {
        // ✅ Atualizar também a lista de teses
        filtrarTeses();
    }
}

function toggleFavoritoModal() {
    if (!currentModalItem) return;
    toggleFavorito(currentModalItem.id);
    
    const btn = document.getElementById('favoritoModalBtn');
    const isFavorito = favoritos.includes(currentModalItem.id);
    btn.textContent = isFavorito ? '⭐ Remover Favorito' : '⭐ Favoritar';
}

function renderizarFavoritos() {
    try {
        const content = document.getElementById('favoritosContent');
        
        if (!content) {
            console.warn('⚠️ Elemento favoritosContent não encontrado');
            return;
        }
        
        if (favoritos.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <h3>⭐ Nenhum favorito ainda</h3>
                    <p>Adicione itens aos favoritos clicando na estrela</p>
                </div>
            `;
            return;
        }
        
        const itensFavoritos = favoritos
            .map(favId => todosItens.find(i => i.id === favId))
            .filter(item => item !== undefined);
        
        if (itensFavoritos.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <h3>⭐ Nenhum favorito encontrado</h3>
                    <p>Os itens favoritados foram removidos ou não existem mais</p>
                </div>
            `;
            return;
        }
        
        const containerClass = viewMode === 'grid' ? 'results-grid' : 'results-list';
        let html = `<div class="${containerClass}">`;
        
        itensFavoritos.forEach(item => {
            html += criarCardHTML(item);
        });
        
        html += '</div>';
        content.innerHTML = html;
    } catch (error) {
        console.error('❌ Erro ao renderizar favoritos:', error);
    }
}

// ========== ANOTAÇÕES ==========
function salvarAnotacao(id, texto) {
    if (texto.trim()) {
        anotacoes[id] = texto;
    } else {
        delete anotacoes[id];
    }
    localStorage.setItem('juristst_anotacoes', JSON.stringify(anotacoes));
    
    // Mostrar indicador de salvamento
    const savedIndicator = document.querySelector('.annotation-saved');
    if (savedIndicator) {
        savedIndicator.classList.add('show');
        setTimeout(() => {
            savedIndicator.classList.remove('show');
        }, 2000);
    }
}

function abrirModalAnotacao(id) {
    const item = todosItens.find(i => i.id === id);
    if (!item) return;
    
    abrirDetalhes(id);
    
    // Focar no campo de anotação após abrir o modal
    setTimeout(() => {
        const textarea = document.getElementById('annotationTextarea');
        if (textarea) {
            textarea.focus();
        }
    }, 300);
}

// ========== TAGS E CORRELAÇÕES ==========
function adicionarTag(id, tag) {
    if (!tags[id]) {
        tags[id] = [];
    }
    
    if (!tags[id].includes(tag) && tag.trim()) {
        tags[id].push(tag.trim());
        localStorage.setItem('juristst_tags', JSON.stringify(tags));
        renderizarTags(id);
        
        // Atualizar visualização se necessário
        if (currentTab === 'jurisprudencia') {
            renderizarResultados();
        } else if (currentTab === 'favoritos') {
            renderizarFavoritos();
        } else if (currentTab === 'teses') {
            filtrarTeses();
        }
    }
}

function removerTag(id, tag) {
    if (tags[id]) {
        tags[id] = tags[id].filter(t => t !== tag);
        if (tags[id].length === 0) {
            delete tags[id];
        }
        localStorage.setItem('juristst_tags', JSON.stringify(tags));
        renderizarTags(id);
        
        // Atualizar visualização se necessário
        if (currentTab === 'jurisprudencia') {
            renderizarResultados();
        } else if (currentTab === 'favoritos') {
            renderizarFavoritos();
        } else if (currentTab === 'teses') {
            filtrarTeses();
        }
    }
}

function renderizarTags(id) {
    const tagsContainer = document.getElementById('tagsList');
    if (!tagsContainer) return;
    
    const itemTags = tags[id] || [];
    
    if (itemTags.length === 0) {
        tagsContainer.innerHTML = '<p style="color: var(--text-light);">Nenhuma tag adicionada</p>';
        return;
    }
    
    tagsContainer.innerHTML = itemTags.map(tag => `
        <span class="tag-item">
            ${tag}
            <button class="tag-remove" onclick="removerTag('${id}', '${tag}')">×</button>
        </span>
    `).join('');
}

function adicionarCorrelacao(id1, id2) {
    if (!correlacoes[id1]) {
        correlacoes[id1] = [];
    }
    if (!correlacoes[id2]) {
        correlacoes[id2] = [];
    }
    
    if (!correlacoes[id1].includes(id2)) {
        correlacoes[id1].push(id2);
    }
    if (!correlacoes[id2].includes(id1)) {
        correlacoes[id2].push(id1);
    }
    
    localStorage.setItem('juristst_correlacoes', JSON.stringify(correlacoes));
}

function removerCorrelacao(id1, id2) {
    if (correlacoes[id1]) {
        correlacoes[id1] = correlacoes[id1].filter(id => id !== id2);
        if (correlacoes[id1].length === 0) {
            delete correlacoes[id1];
        }
    }
    if (correlacoes[id2]) {
        correlacoes[id2] = correlacoes[id2].filter(id => id !== id1);
        if (correlacoes[id2].length === 0) {
            delete correlacoes[id2];
        }
    }
    
    localStorage.setItem('juristst_correlacoes', JSON.stringify(correlacoes));
}

// ========== MODAL DE DETALHES ==========
function abrirDetalhes(id) {
    console.log('🔍 abrirDetalhes chamado com ID:', id);
    const item = todosItens.find(i => i.id === id);
    
    if (!item) {
        console.error('❌ Item não encontrado em todosItens para ID:', id);
        console.log('📋 IDs disponíveis (primeiros 10):', todosItens.slice(0, 10).map(i => ({id: i.id, source: i.source})));
        mostrarToast('Erro: Item não encontrado', 'error');
        return;
    }
    
    console.log('✅ Item encontrado:', item.id, '| Source:', item.source, '| Tipo:', item.tipo, '| Tema:', item.tema);
    
    currentModalItem = item;
    
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    const tipo = item.tipo || 'sumula';
    const tipoDisplay = {
        'sumula': 'Súmula',
        'oj': 'OJ',
        'precedente': 'Precedente Normativo',
        'informativo': 'Informativo',
        'irr': 'IRR',
        'irdr': 'IRDR',
        'iac': 'IAC'
    }[tipo] || tipo;
    
    // ✅ CORREÇÃO 3: TESES COM ANOTAÇÕES E TAGS
    // Verificação dupla para garantir detecção de teses
    if (item.source === 'tese' || item.tema) {
        console.log('🎯 Detectada tese, abrindo modal especializado:', item.id, '| Tema:', item.tema);
        abrirModalTese(item);
        return;
    }
    
    // Para informativos e documentos uploaded
    if (item.source === 'informativo') {
        modalTitle.innerHTML = `
            ${tipoDisplay} ${item.nome || ''}
        `;
        
        let bodyHtml = `
            <div class="modal-section">
                <h3>📄 Documento</h3>
                <div style="padding: 15px; background: #f5f5f5; border-radius: 8px;">
                    <div style="margin-bottom: 10px;">
                        <strong>Nome:</strong> ${item.nome}
                    </div>
                    <div style="margin-bottom: 10px;">
                        <strong>Data:</strong> ${new Date(item.dataUpload).toLocaleDateString('pt-BR')}
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong>Tamanho:</strong> ${item.tamanho}
                    </div>
        `;
        
        // Se for PDF, mostrar visualizador
        if (item.nome && item.nome.toLowerCase().endsWith('.pdf')) {
            if (item.conteudo) {
                bodyHtml += `
                    <div style="margin-top: 15px;">
                        <iframe src="${item.conteudo}" 
                                style="width: 100%; height: 500px; border: 1px solid #ddd; border-radius: 4px;"
                                frameborder="0">
                        </iframe>
                    </div>
                `;
            } else {
                bodyHtml += `
                    <div style="padding: 20px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; margin-top: 15px;">
                        ⚠️ <strong>PDF carregado mas conteúdo não disponível para visualização</strong><br>
                        <small>Isso é normal para arquivos carregados localmente. O arquivo está salvo no navegador.</small>
                    </div>
                `;
            }
        } else if (item.texto) {
            // Se for TXT ou tiver texto extraído
            bodyHtml += `
                <div style="margin-top: 15px; max-height: 400px; overflow-y: auto; padding: 15px; background: white; border: 1px solid #ddd; border-radius: 4px; white-space: pre-wrap; font-family: monospace; font-size: 0.9em;">
${item.texto}
                </div>
            `;
        }
        
        bodyHtml += `</div></div>`;
        
        // Seção de Anotações
        const anotacao = anotacoes[item.id] || '';
        bodyHtml += `
            <div class="annotation-section">
                <div class="annotation-header">
                    <div class="annotation-title">
                        📝 Anotações Pessoais
                    </div>
                </div>
                <textarea id="annotationTextarea" class="annotation-textarea" 
                          placeholder="Adicione suas anotações sobre este documento..." 
                          onchange="salvarAnotacao('${item.id}', this.value)">${anotacao}</textarea>
                <div class="annotation-saved">✅ Anotação salva</div>
            </div>
        `;
        
        // Seção de Tags
        const itemTags = tags[item.id] || [];
        bodyHtml += `
            <div class="tags-section">
                <div class="tags-header">
                    <div class="tags-title">🏷️ Tags</div>
                </div>
                <div class="tags-list" id="tagsList">
                    ${itemTags.map(tag => `
                        <span class="tag-item">
                            ${tag}
                            <button onclick="removerTag('${item.id}', '${tag}')" class="tag-remove">×</button>
                        </span>
                    `).join('')}
                </div>
                <div class="tags-input-container">
                    <input type="text" id="tagInput" 
                           placeholder="Digite uma tag e pressione Enter" 
                           onkeypress="if(event.key==='Enter'){adicionarTag('${item.id}', this.value); this.value='';}">
                    <button onclick="adicionarTag('${item.id}', document.getElementById('tagInput').value); document.getElementById('tagInput').value='';" 
                            class="btn btn-primary btn-sm">
                        Adicionar
                    </button>
                </div>
            </div>
        `;
        
        modalBody.innerHTML = bodyHtml;
        modal.style.display = 'flex';
        modal.classList.add('active');
        return;
    }
    
    // Para jurisprudência (súmulas, OJs, precedentes) - código original
    modalTitle.innerHTML = `
        ${tipoDisplay} ${item.numero || item.nome || ''}
        ${item.cancelada ? '<span class="canceled-badge">❌ CANCELADA</span>' : ''}
    `;
    
    // Atualizar botão de favorito
    const favBtn = document.getElementById('favoritoModalBtn');
    const isFavorito = favoritos.includes(item.id);
    favBtn.textContent = isFavorito ? '⭐ Remover Favorito' : '⭐ Favoritar';
    
    let bodyHtml = '';
    
    // Alert de cancelamento
    if (item.cancelada) {
        bodyHtml += `
            <div class="cancelado-alert" style="background: #ffebee; border: 2px solid var(--danger); border-radius: 10px; padding: 15px; margin-bottom: 20px;">
                <div style="display: flex; gap: 15px;">
                    <div style="font-size: 1.5em; color: var(--danger);">⚠️</div>
                    <div>
                        <div style="font-weight: 600; color: var(--danger); margin-bottom: 5px;">
                            ATENÇÃO: ESTE VERBETE FOI CANCELADO
                        </div>
                        <div style="color: #c62828;">
                            ${item.referencia || 'Este verbete não está mais em vigor'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Conteúdo principal
    bodyHtml += `
        <div class="modal-section">
            <h3>Título</h3>
            <div class="modal-text">${item.titulo || 'Sem título'}</div>
        </div>
        
        <div class="modal-section">
            <h3>Texto</h3>
            <div class="modal-text">${formatarTexto(item.texto_completo || item.texto || 'Sem conteúdo')}</div>
        </div>
    `;
    
    // Seção de Anotações
    const anotacao = anotacoes[item.id] || '';
    bodyHtml += `
        <div class="annotation-section">
            <div class="annotation-header">
                <div class="annotation-title">
                    📝 Anotações Pessoais
                </div>
            </div>
            <textarea id="annotationTextarea" class="annotation-textarea" 
                      placeholder="Adicione suas anotações aqui..." 
                      onchange="salvarAnotacao('${item.id}', this.value)">${anotacao}</textarea>
            <div class="annotation-saved">✅ Anotação salva</div>
        </div>
    `;
    
    // Seção de Tags
    bodyHtml += `
        <div class="tags-section">
            <div class="tags-header">
                <div class="tags-title">
                    🏷️ Tags
                </div>
            </div>
            <div class="tags-input-group">
                <input type="text" id="tagInput" class="tags-input" 
                       placeholder="Digite uma tag e pressione Enter" 
                       onkeypress="if(event.key==='Enter'){adicionarTag('${item.id}', this.value); this.value=''}">
                <button class="btn btn-primary btn-sm" 
                        onclick="adicionarTag('${item.id}', document.getElementById('tagInput').value); document.getElementById('tagInput').value=''">
                    Adicionar
                </button>
            </div>
            <div class="tags-list" id="tagsList"></div>
        </div>
    `;
    
    // Seção de Itens Relacionados
    const relacionados = correlacoes[item.id] || [];
    if (relacionados.length > 0) {
        bodyHtml += `
            <div class="related-section">
                <div class="related-title">
                    🔗 Itens Relacionados
                </div>
                <div class="related-list">
                    ${relacionados.map(relId => {
                        const relItem = todosItens.find(i => i.id === relId);
                        if (!relItem) return '';
                        
                        const relTipo = {
                            'sumula': 'Súmula',
                            'oj': 'OJ',
                            'precedente': 'Precedente',
                            'informativo': 'Informativo',
                            'irr': 'IRR',
                            'irdr': 'IRDR',
                            'iac': 'IAC'
                        }[relItem.tipo] || relItem.tipo;
                        
                        return `
                            <div class="related-item" onclick="abrirDetalhes('${relId}')">
                                <div class="related-item-header">
                                    <span class="related-item-title">${relTipo} ${relItem.numero || relItem.nome || ''}</span>
                                    <span class="related-item-type">${relTipo}</span>
                                </div>
                                <div class="related-item-preview">${(relItem.titulo || '').substring(0, 100)}...</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    // Informações adicionais
    if (item.referencia || item.orgao) {
        bodyHtml += `
            <div style="background: var(--bg-light); padding: 15px; border-radius: 8px; margin-top: 20px;">
                ${item.referencia ? `
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <span style="font-weight: 600;">Referência:</span>
                        <span>${item.referencia}</span>
                    </div>
                ` : ''}
                ${item.orgao ? `
                    <div style="display: flex; gap: 10px;">
                        <span style="font-weight: 600;">Órgão:</span>
                        <span>${item.orgao}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    modalBody.innerHTML = bodyHtml;
    modal.classList.add('active');
    
    // Renderizar tags após criar o HTML
    renderizarTags(item.id);
    
    // Salvar texto atual no modal para cópia
    modal.dataset.textoCompleto = item.texto_completo || item.texto || '';
    
    // CRÍTICO: Abrir o modal com display flex
    modal.style.display = 'flex';
    modal.classList.add('active');
    
    console.log('✅ Modal aberto para:', item.id);
}

// ✅ CORREÇÃO 4: Modal de Teses com fechamento correto e anotações/tags
function abrirModalTese(tese) {
    console.log('🎯 abrirModalTese chamado para:', tese.id, '| Tema:', tese.tema);
    
    currentModalItem = tese;
    
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    // Título
    const tipoBadge = {
        'irr': '#3498db',
        'irdr': '#e74c3c',
        'iac': '#f39c12',
        'rrag': '#9b59b6'
    }[tese.tipo?.toLowerCase()] || '#3498db';
    
    modalTitle.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px;">
            <span class="result-type" style="background: ${tipoBadge}; padding: 8px 16px; border-radius: 8px;">
                ${tese.tipo || 'IRR'}
            </span>
            <span>Tema ${tese.tema}</span>
        </div>
    `;
    
    // Corpo do modal
    let html = `
        <div class="modal-section">
            <h3 class="modal-section-title">📋 Processo Representativo</h3>
            <p class="modal-text"><strong>${tese.numero_processo || 'Não informado'}</strong></p>
            ${tese.acordao ? `<p class="modal-text" style="color: #7f8c8d;">${tese.acordao}</p>` : ''}
        </div>
    `;
    
    if (tese.relator) {
        html += `
            <div class="modal-section">
                <h3 class="modal-section-title">👤 Relator(a)</h3>
                <p class="modal-text">${tese.relator}</p>
            </div>
        `;
    }
    
    html += `
        <div class="modal-section">
            <h3 class="modal-section-title">⚖️ Tese Jurídica</h3>
            <div class="modal-text" style="text-align: justify; line-height: 1.8;">
                ${tese.tese || 'Tese não disponível'}
            </div>
        </div>
    `;
    
    if (tese.ultimo_movimento) {
        html += `
            <div class="modal-section">
                <h3 class="modal-section-title">📊 Último Movimento</h3>
                <p class="modal-text">${tese.ultimo_movimento}</p>
            </div>
        `;
    }
    
    if (tese.decisao_suspensao) {
        html += `
            <div class="modal-section" style="background: #fff3cd; border-left: 4px solid #f39c12;">
                <h3 class="modal-section-title" style="color: #856404;">⚠️ Decisão de Suspensão</h3>
                <p class="modal-text" style="color: #856404;">
                    Este tema possui decisão de suspensão de processos
                </p>
            </div>
        `;
    }
    
    // ✅ ADICIONANDO ANOTAÇÕES PARA TESES
    const anotacao = anotacoes[tese.id] || '';
    html += `
        <div class="annotation-section">
            <div class="annotation-header">
                <div class="annotation-title">
                    📝 Anotações Pessoais
                </div>
            </div>
            <textarea id="annotationTextarea" class="annotation-textarea" 
                      placeholder="Adicione suas anotações sobre esta tese..." 
                      onchange="salvarAnotacao('${tese.id}', this.value)">${anotacao}</textarea>
            <div class="annotation-saved">✅ Anotação salva</div>
        </div>
    `;
    
    // ✅ ADICIONANDO TAGS PARA TESES
    const itemTags = tags[tese.id] || [];
    html += `
        <div class="tags-section">
            <div class="tags-header">
                <div class="tags-title">
                    🏷️ Tags
                </div>
            </div>
            <div class="tags-input-group">
                <input type="text" id="tagInput" class="tags-input" 
                       placeholder="Digite uma tag e pressione Enter" 
                       onkeypress="if(event.key==='Enter'){adicionarTag('${tese.id}', this.value); this.value=''}">
                <button class="btn btn-primary btn-sm" 
                        onclick="adicionarTag('${tese.id}', document.getElementById('tagInput').value); document.getElementById('tagInput').value=''">
                    Adicionar
                </button>
            </div>
            <div class="tags-list" id="tagsList"></div>
        </div>
    `;
    
    // Links - VALIDAR SE EXISTEM E SÃO VÁLIDOS
    if ((tese.link_processo && tese.link_processo.startsWith('http')) || 
        (tese.link_pdf && tese.link_pdf.startsWith('http'))) {
        html += `
            <div class="modal-section">
                <h3 class="modal-section-title">🔗 Links Oficiais</h3>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        `;
        
        if (tese.link_processo && tese.link_processo.startsWith('http')) {
            html += `
                <a href="${tese.link_processo}" target="_blank" class="btn btn-sm btn-secondary">
                    📄 Ver Processo no TST
                </a>
            `;
        }
        
        if (tese.link_pdf && tese.link_pdf.startsWith('http')) {
            html += `
                <a href="${tese.link_pdf}" target="_blank" class="btn btn-sm btn-secondary">
                    📑 Baixar PDF
                </a>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
    }
    
    modalBody.innerHTML = html;
    
    // Renderizar tags após inserir HTML
    renderizarTags(tese.id);
    
    // Atualizar botão de favorito
    const isFavorito = favoritos.includes(tese.id);
    const favBtn = document.getElementById('favoritoModalBtn');
    if (favBtn) {
        favBtn.textContent = isFavorito ? '⭐ Remover dos Favoritos' : '⭐ Favoritar';
    }
    
    // ✅ ABERTURA CORRETA DO MODAL
    modal.style.display = 'flex';
    modal.classList.add('active');
    
    console.log('✅ Modal de tese aberto:', tese.id);
}

// ✅ CORREÇÃO 4: Fechamento robusto do modal
function fecharModal() {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal) {
        console.error('❌ Modal não encontrado');
        return;
    }
    
    console.log('🔄 Fechando modal...');
    
    // 1. Limpar iframes PRIMEIRO
    if (modalBody) {
        const iframes = modalBody.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            iframe.src = 'about:blank';
            iframe.remove();
        });
    }
    
    // 2. Remover classe active (inicia animação)
    modal.classList.remove('active');
    
    // 3. Aguardar animação antes de esconder completamente
    setTimeout(() => {
        modal.style.display = 'none';
        
        // 4. Limpar conteúdo do modal
        if (modalBody) {
            modalBody.innerHTML = '';
        }
        
        // 5. Resetar estado
        currentModalItem = null;
        
        console.log('✅ Modal fechado e limpo');
    }, 300); // Tempo da animação CSS
}

// ========== UPLOAD DE ARQUIVOS ==========

// Função para extrair texto de PDF usando PDF.js
async function extrairTextoPDF(file) {
    try {
        console.log('📄 Iniciando extração de texto do PDF:', file.name);
        
        // Converter arquivo para ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        
        // Carregar PDF
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        console.log(`📊 PDF carregado: ${pdf.numPages} páginas`);
        
        let textoCompleto = '';
        
        // Extrair texto de cada página
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            // Combinar todos os items de texto da página
            const pageText = textContent.items
                .map(item => item.str)
                .join(' ');
            
            textoCompleto += pageText + '\n\n';
            
            // Log de progresso
            if (pageNum % 10 === 0 || pageNum === pdf.numPages) {
                console.log(`📖 Extraídas ${pageNum}/${pdf.numPages} páginas`);
            }
        }
        
        console.log(`✅ Extração concluída: ${textoCompleto.length} caracteres`);
        return textoCompleto;
        
    } catch (error) {
        console.error('❌ Erro na extração de texto:', error);
        throw error;
    }
}

function handleFileSelect(event, tipo) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach(file => {
        processarArquivo(file, tipo);
    });
}

function handleDrop(event, tipo) {
    event.preventDefault();
    event.target.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach(file => {
        processarArquivo(file, tipo);
    });
}

function handleDragOver(event) {
    event.preventDefault();
    event.target.closest('.upload-area').classList.add('dragover');
}

function handleDragLeave(event) {
    event.target.closest('.upload-area').classList.remove('dragover');
}

function processarArquivo(file, tipo) {
    console.log('🔄 Processando arquivo:', file.name, 'Tipo:', file.type);
    
    // Apenas PDFs são suportados
    if (!file.type.includes('pdf')) {
        mostrarToast('Por favor, selecione apenas arquivos PDF', 'error');
        console.error('❌ Arquivo não é PDF:', file.type);
        return;
    }
    
    // Verificar se PDF.js está disponível
    if (typeof pdfjsLib === 'undefined') {
        mostrarToast('❌ PDF.js não carregado. Recarregue a página (Cmd+R).', 'error');
        console.error('❌ PDF.js não disponível. Verifique se o script foi carregado.');
        return;
    }
    
    console.log('✅ PDF.js disponível, iniciando extração...');
    mostrarToast('📄 Extraindo texto do PDF... Aguarde...', 'info');
    
    // Extrair texto do PDF
    extrairTextoPDF(file).then(textoExtraido => {
        console.log(`✅ Texto extraído: ${textoExtraido.length} caracteres`);
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            // ✅ USANDO GERENCIADOR DE IDs
            const timestamp = Date.now();
            const novoId = tipo === 'tese' ? 
                gerarIdConsistente('tese', `upload_${timestamp}`) :
                gerarIdConsistente('informativo', timestamp);
            
            const novoItem = {
                id: novoId,
                nome: file.name,
                tipo: tipo === 'tese' ? obterTipoTese() : tipo,
                dataUpload: new Date().toISOString(),
                tamanho: formatarTamanho(file.size),
                conteudo: e.target.result, // Data URL do PDF
                textoExtraido: textoExtraido, // ✅ TEXTO PARA BUSCA
                texto: textoExtraido, // ✅ Também salvar como 'texto' para compatibilidade
                source: tipo
            };
            
            console.log('💾 Item criado:', novoItem.id);
            
            if (tipo === 'informativo') {
                informativos.push(novoItem);
                localStorage.setItem('juristst_informativos', JSON.stringify(informativos));
                renderizarInformativos();
            } else if (tipo === 'tese') {
                tesesVinculantes.push(novoItem);
                localStorage.setItem('juristst_teses', JSON.stringify(tesesVinculantes));
                filtrarTeses();
            }
            
            // Adicionar ao array geral
            todosItens.push(novoItem);
            
            mostrarToast(`✅ ${file.name} adicionado com sucesso (texto extraído)`, 'success');
        };
        
        reader.onerror = function() {
            mostrarToast(`Erro ao ler o arquivo ${file.name}`, 'error');
        };
        
        reader.readAsDataURL(file);
    }).catch(error => {
        console.error('❌ Erro ao extrair texto:', error);
        mostrarToast('Erro ao extrair texto do PDF. Tente novamente.', 'error');
    });
}

function obterTipoTese() {
    const select = document.getElementById('filterTipoTese');
    if (select && select.value !== 'todos') {
        return select.value;
    }
    
    // Perguntar ao usuário
    const tipos = ['irr', 'irdr', 'iac'];
    const escolha = prompt('Tipo de tese:\n1 - IRR (Incidente de Recursos Repetitivos)\n2 - IRDR (Incidente de Resolução de Demandas Repetitivas)\n3 - IAC (Incidente de Assunção de Competência)\n\nDigite o número:');
    
    if (escolha === '1') return 'irr';
    if (escolha === '2') return 'irdr';
    if (escolha === '3') return 'iac';
    
    return 'irr'; // padrão
}

function formatarTamanho(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ========== RENDERIZAÇÃO DE INFORMATIVOS ==========
function renderizarInformativos() {
    try {
        const lista = document.getElementById('informativosList');
        
        if (!lista) {
            console.warn('⚠️ Elemento informativosList não encontrado');
            return;
        }
        
        if (informativos.length === 0) {
            lista.innerHTML = `
                <div class="empty-state">
                    <p>Nenhum informativo adicionado ainda</p>
                </div>
            `;
            return;
        }
        
        lista.innerHTML = informativos.map(info => `
            <div class="document-item">
                <div class="document-info">
                    <div class="document-title">${info.nome}</div>
                    <div class="document-meta">
                        📅 ${new Date(info.dataUpload).toLocaleDateString('pt-BR')} | 
                        📁 ${info.tamanho}
                    </div>
                </div>
                <div class="document-actions">
                    <button class="btn btn-warning btn-sm" onclick="toggleFavorito('${info.id}')">
                        ${favoritos.includes(info.id) ? '⭐' : '☆'}
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="abrirDetalhes('${info.id}')">
                        👁️ Ver
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="removerDocumento('${info.id}', 'informativo')">
                        🗑️ Remover
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('❌ Erro ao renderizar informativos:', error);
    }
}

// ========== RENDERIZAÇÃO DE TESES ==========
// ✅ BUSCA NORMALIZADA APLICADA
function filtrarTeses() {
    const tipoFiltro = document.getElementById('filterTipoTese')?.value || 'todos';
    const searchTerm = document.getElementById('searchTeseInput')?.value?.trim() || '';
    const searchNormalizado = normalizarTexto(searchTerm);
    
    let tesesFiltradas = tesesVinculantes;
    
    // Filtrar por tipo
    if (tipoFiltro !== 'todos') {
        tesesFiltradas = tesesFiltradas.filter(tese => {
            const tipo = tese.tipo?.toLowerCase() || '';
            return tipo === tipoFiltro;
        });
    }
    
    // Filtrar por busca NORMALIZADA
    if (searchNormalizado) {
        tesesFiltradas = tesesFiltradas.filter(tese => {
            const tema = tese.tema || '';
            const processo = tese.numero_processo || '';
            const teseTexto = tese.tese || '';
            const itemTags = tags[tese.id] || [];
            const anotacao = anotacoes[tese.id] || '';
            
            const textoCompleto = `${tema} ${processo} ${teseTexto} ${itemTags.join(' ')} ${anotacao}`;
            
            return contemTermoNormalizado(textoCompleto, searchTerm);
        });
    }
    
    renderizarTeses(tesesFiltradas);
}

function renderizarTeses(teses = tesesVinculantes) {
    const container = document.getElementById('tesesList');
    
    // Atualizar contador
    const countElement = document.getElementById('tesesCount');
    if (countElement) {
        countElement.textContent = `${teses.length} ${teses.length === 1 ? 'tese encontrada' : 'teses encontradas'}`;
    }
    
    if (!teses || teses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>📋 Nenhuma tese encontrada</h3>
                <p>Use o painel Admin para adicionar teses vinculantes</p>
            </div>
        `;
        return;
    }
    
    let html = '<div class="results-grid">';
    
    teses.forEach(tese => {
        const isFavorito = favoritos.includes(tese.id);
        const statusClass = tese.decisao_suspensao ? 'suspended' : 'active';
        const statusIcon = tese.decisao_suspensao ? '⏸️' : '✅';
        const statusText = tese.decisao_suspensao ? 'Com Suspensão' : 'Ativo';
        
        const itemTags = tags[tese.id] || [];
        const hasAnotacao = anotacoes[tese.id] && anotacoes[tese.id].trim() !== '';
        
        let tipoBadgeColor = '#3498db';
        if (tese.tipo === 'IRDR') tipoBadgeColor = '#e74c3c';
        if (tese.tipo === 'IAC') tipoBadgeColor = '#f39c12';
        if (tese.tipo === 'RRAg') tipoBadgeColor = '#9b59b6';
        
        html += `
            <div class="card" onclick="abrirDetalhes('${tese.id}')">
                <div class="card-header">
                    <div class="card-number">
                        <span class="card-badge" style="background: ${tipoBadgeColor};">${tese.tipo || 'IRR'}</span>
                        Tema ${tese.tema}
                    </div>
                    <button class="card-action favorite ${isFavorito ? 'active' : ''}" 
                            onclick="event.stopPropagation(); toggleFavorito('${tese.id}')">
                        ${isFavorito ? '⭐' : '☆'}
                    </button>
                </div>
                
                ${hasAnotacao ? `
                    <div class="card-indicators">
                        <div class="indicator indicator-note">📝 Anotação</div>
                    </div>
                ` : ''}
                
                <div class="card-title">${tese.numero_processo || 'Sem processo'}</div>
                
                <div class="card-preview">
                    ${truncateText(tese.tese || 'Sem tese disponível', 150)}
                </div>
                
                <div class="card-footer">
                    <span class="status-badge ${statusClass}">
                        ${statusIcon} ${statusText}
                    </span>
                    ${tese.acordao ? `<span style="color: var(--text-light); font-size: 0.85em;">${tese.acordao}</span>` : ''}
                </div>
                
                ${itemTags.length > 0 ? `
                    <div class="card-tags">
                        ${itemTags.slice(0, 3).map(tag => 
                            `<span class="tag">${tag}</span>`
                        ).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// ========== REMOÇÃO DE DOCUMENTOS ==========
function removerDocumento(id, tipo) {
    if (!confirm('Tem certeza que deseja remover este documento?')) {
        return;
    }
    
    if (tipo === 'informativo') {
        informativos = informativos.filter(info => info.id !== id);
        localStorage.setItem('juristst_informativos', JSON.stringify(informativos));
        renderizarInformativos();
    } else if (tipo === 'tese') {
        tesesVinculantes = tesesVinculantes.filter(tese => tese.id !== id);
        localStorage.setItem('juristst_teses', JSON.stringify(tesesVinculantes));
        filtrarTeses();
    }
    
    // Remover do array geral
    todosItens = todosItens.filter(item => item.id !== id);
    
    // Remover dos favoritos se estiver lá
    if (favoritos.includes(id)) {
        favoritos = favoritos.filter(fav => fav !== id);
        localStorage.setItem('juristst_favoritos', JSON.stringify(favoritos));
    }
    
    // Remover anotações
    if (anotacoes[id]) {
        delete anotacoes[id];
        localStorage.setItem('juristst_anotacoes', JSON.stringify(anotacoes));
    }
    
    // Remover tags
    if (tags[id]) {
        delete tags[id];
        localStorage.setItem('juristst_tags', JSON.stringify(tags));
    }
    
    // Remover correlações
    if (correlacoes[id]) {
        delete correlacoes[id];
        localStorage.setItem('juristst_correlacoes', JSON.stringify(correlacoes));
    }
    
    mostrarToast('Documento removido com sucesso', 'success');
}

// ========== UTILITÁRIOS ==========
function formatarTexto(texto) {
    if (!texto) return '';
    
    return texto
        .replace(/\n/g, '<br><br>')
        .replace(/(\d+\.\s)/g, '<br><strong>$1</strong>')
        .replace(/(I+\s-\s)/g, '<br><br><strong>$1</strong>')
        .replace(/(a\)\s)/g, '<br><strong>$1</strong>')
        .replace(/(b\)\s)/g, '<br><strong>$1</strong>')
        .replace(/(c\)\s)/g, '<br><strong>$1</strong>');
}

function copiarItem(id) {
    const item = todosItens.find(i => i.id === id);
    if (!item) return;
    
    const tipo = {
        'sumula': 'Súmula',
        'oj': 'OJ',
        'precedente': 'Precedente Normativo',
        'informativo': 'Informativo',
        'irr': 'IRR',
        'irdr': 'IRDR',
        'iac': 'IAC'
    }[item.tipo] || item.tipo;
    
    const texto = `${tipo} ${item.numero || item.nome || ''} - ${item.titulo || ''}\n\n${item.texto_completo || item.texto || item.conteudo || ''}`;
    
    navigator.clipboard.writeText(texto).then(() => {
        mostrarToast('Texto copiado para a área de transferência', 'success');
    }).catch(err => {
        console.error('Erro ao copiar:', err);
        mostrarToast('Erro ao copiar texto', 'error');
    });
}

function copiarTexto() {
    const modal = document.getElementById('modal');
    const texto = modal.dataset.textoCompleto || '';
    
    if (texto) {
        navigator.clipboard.writeText(texto).then(() => {
            mostrarToast('Texto copiado para a área de transferência', 'success');
        }).catch(err => {
            console.error('Erro ao copiar:', err);
            mostrarToast('Erro ao copiar texto', 'error');
        });
    }
}

function compartilharItem(id) {
    const item = todosItens.find(i => i.id === id);
    if (!item) return;
    
    const tipo = {
        'sumula': 'Súmula',
        'oj': 'OJ',
        'precedente': 'Precedente Normativo',
        'informativo': 'Informativo',
        'irr': 'IRR',
        'irdr': 'IRDR',
        'iac': 'IAC'
    }[item.tipo] || item.tipo;
    
    const texto = `${tipo} ${item.numero || item.nome || ''} - ${item.titulo || ''}`;
    const url = window.location.href;
    
    if (navigator.share) {
        navigator.share({
            title: 'JurisTST',
            text: texto,
            url: url
        }).catch(err => console.log('Erro ao compartilhar:', err));
    } else {
        // Fallback: copiar link
        navigator.clipboard.writeText(`${texto}\n\n${url}`).then(() => {
            mostrarToast('Link copiado para compartilhamento', 'success');
        });
    }
}

function limparFiltros() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterTipo').value = 'todos';
    document.getElementById('filterOrgao').value = 'todos';
    document.getElementById('filterNumero').value = '';
    document.getElementById('filterTags').value = '';
    document.getElementById('statusTodos').checked = true;
    
    searchTerm = '';
    statusFiltro = 'todos';
    
    realizarBusca();
    mostrarToast('Filtros limpos', 'success');
}

function exportarResultados() {
    if (itensFiltrados.length === 0) {
        mostrarToast('Nenhum resultado para exportar', 'error');
        return;
    }
    
    let csvContent = "Tipo,Número,Título,Status,Texto,Referência,Tags,Anotações\n";
    
    itensFiltrados.forEach(item => {
        const tipo = {
            'sumula': 'Súmula',
            'oj': 'OJ',
            'precedente': 'Precedente Normativo',
            'informativo': 'Informativo',
            'irr': 'IRR',
            'irdr': 'IRDR',
            'iac': 'IAC'
        }[item.tipo] || item.tipo;
        
        const status = item.cancelada ? 'Cancelada' : 'Vigente';
        const titulo = (item.titulo || '').replace(/"/g, '""');
        const texto = (item.texto || '').replace(/"/g, '""');
        const referencia = (item.referencia || '').replace(/"/g, '""');
        const itemTags = (tags[item.id] || []).join('; ');
        const anotacao = (anotacoes[item.id] || '').replace(/"/g, '""');
        
        csvContent += `"${tipo}","${item.numero || item.nome || ''}","${titulo}","${status}","${texto}","${referencia}","${itemTags}","${anotacao}"\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `jurisprudencia_tst_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    mostrarToast(`${itensFiltrados.length} itens exportados`, 'success');
}

function mudarVisualizacao(modo) {
    viewMode = modo;
    
    document.getElementById('viewGrid').classList.toggle('active', modo === 'grid');
    document.getElementById('viewList').classList.toggle('active', modo === 'list');
    
    if (currentTab === 'jurisprudencia') {
        renderizarResultados();
    } else if (currentTab === 'favoritos') {
        renderizarFavoritos();
    }
}

function mostrarToast(mensagem, tipo = '') {
    const toast = document.getElementById('toast');
    toast.textContent = mensagem;
    toast.className = 'toast show';
    
    if (tipo) {
        toast.classList.add(tipo);
    }
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// ========== EVENT LISTENERS ==========
document.addEventListener('keydown', (e) => {
    // Fechar modal com ESC
    if (e.key === 'Escape') {
        fecharModal();
    }
    
    // Atalhos de teclado
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 'k': // Ctrl+K para buscar
                e.preventDefault();
                document.getElementById('searchInput').focus();
                break;
            case 'b': // Ctrl+B para favoritos
                e.preventDefault();
                const favButton = Array.from(document.querySelectorAll('.tab-button'))
                    .find(btn => btn.textContent.includes('Favoritos'));
                if (favButton) switchTab('favoritos', favButton);
                break;
            case 'e': // Ctrl+E para exportar
                e.preventDefault();
                exportarResultados();
                break;
        }
    }
});

// Fechar modal clicando fora
document.getElementById('modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal') {
        fecharModal();
    }
});

// ========== FUNÇÕES DE DEBUG ==========
window.debugStats = function() {
    console.log('📊 Estatísticas do Sistema:');
    console.log(`Total de itens: ${todosItens.length}`);
    console.log(`Jurisprudência: ${todosItens.filter(i => i.source === 'jurisprudencia').length}`);
    console.log(`Informativos: ${informativos.length}`);
    console.log(`Teses Vinculantes: ${tesesVinculantes.length}`);
    console.log(`Favoritos: ${favoritos.length}`);
    console.log(`Itens com anotações: ${Object.keys(anotacoes).length}`);
    console.log(`Itens com tags: ${Object.keys(tags).length}`);
    console.log(`Correlações: ${Object.keys(correlacoes).length}`);
    
    console.log('\n📝 Verbetes cancelados:');
    const canceladas = todosItens.filter(item => item.cancelada);
    canceladas.forEach(item => {
        console.log(`- ${item.tipo} ${item.numero}: ${item.titulo}`);
    });
};

window.exportarDados = function() {
    const dados = {
        favoritos,
        anotacoes,
        tags,
        correlacoes,
        informativos,
        tesesVinculantes
    };
    
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `juristst_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    console.log('✅ Backup exportado com sucesso');
};

window.importarDados = function(arquivo) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const dados = JSON.parse(e.target.result);
            
            // Importar dados
            if (dados.favoritos) {
                favoritos = dados.favoritos;
                localStorage.setItem('juristst_favoritos', JSON.stringify(favoritos));
            }
            if (dados.anotacoes) {
                anotacoes = dados.anotacoes;
                localStorage.setItem('juristst_anotacoes', JSON.stringify(anotacoes));
            }
            if (dados.tags) {
                tags = dados.tags;
                localStorage.setItem('juristst_tags', JSON.stringify(tags));
            }
            if (dados.correlacoes) {
                correlacoes = dados.correlacoes;
                localStorage.setItem('juristst_correlacoes', JSON.stringify(correlacoes));
            }
            if (dados.informativos) {
                informativos = dados.informativos;
                localStorage.setItem('juristst_informativos', JSON.stringify(informativos));
            }
            if (dados.tesesVinculantes) {
                tesesVinculantes = dados.tesesVinculantes;
                localStorage.setItem('juristst_teses', JSON.stringify(tesesVinculantes));
            }
            
            console.log('✅ Dados importados com sucesso');
            mostrarToast('Dados importados com sucesso. Recarregue a página.', 'success');
            
            // Recarregar dados
            setTimeout(() => {
                location.reload();
            }, 2000);
        } catch (error) {
            console.error('❌ Erro ao importar dados:', error);
            mostrarToast('Erro ao importar dados', 'error');
        }
    };
    reader.readAsText(arquivo);
};

window.limparTodosDados = function() {
    if (!confirm('⚠️ ATENÇÃO: Isso irá apagar TODOS os dados salvos (favoritos, anotações, tags, correlações, informativos e teses). Deseja continuar?')) {
        return;
    }
    
    if (!confirm('Esta ação é IRREVERSÍVEL. Tem certeza absoluta?')) {
        return;
    }
    
    // Limpar localStorage
    localStorage.removeItem('juristst_favoritos');
    localStorage.removeItem('juristst_anotacoes');
    localStorage.removeItem('juristst_tags');
    localStorage.removeItem('juristst_correlacoes');
    localStorage.removeItem('juristst_informativos');
    localStorage.removeItem('juristst_teses');
    
    // Limpar variáveis
    favoritos = [];
    anotacoes = {};
    tags = {};
    correlacoes = {};
    informativos = [];
    tesesVinculantes = [];
    
    console.log('🗑️ Todos os dados foram limpos');
    mostrarToast('Todos os dados foram limpos', 'warning');
    
    // Recarregar página
    setTimeout(() => {
        location.reload();
    }, 2000);
};

// ========== INICIALIZAÇÃO ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 JurisTST - Sistema Inteligente de Busca de Jurisprudência');
    console.log('📚 Desenvolvido para Renata - Assessoria Judicial TRT12');
    console.log('⚖️ Versão 3.1 - FASE 1: Correções Críticas Implementadas');
    console.log('');
    console.log('✅ CORREÇÕES APLICADAS:');
    console.log('  1. IDs consistentes em todo sistema');
    console.log('  2. Busca normalizada (ignora acentos)');
    console.log('  3. Anotações e tags em teses vinculantes');
    console.log('  4. Modal com fechamento robusto');
    
    carregarDados();
    
    // Event Listener: Fechar modal com ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('modal');
            if (modal && modal.classList.contains('active')) {
                fecharModal();
            }
        }
    });
    
    // Event Listener: Botão X do modal
    const closeButton = document.querySelector('.modal-close');
    if (closeButton) {
        closeButton.addEventListener('click', fecharModal);
    }
    
    console.log('');
    console.log('💡 Dica: Use os seguintes comandos no console:');
    console.log('  - debugStats() : Ver estatísticas do sistema');
    console.log('  - exportarDados() : Fazer backup dos dados');
    console.log('  - importarDados(arquivo) : Restaurar backup');
    console.log('  - limparTodosDados() : Limpar todos os dados salvos');
});
