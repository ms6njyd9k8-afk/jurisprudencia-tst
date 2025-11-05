// JurisTST - Sistema de Busca de Jurisprudência
// Desenvolvido para Renata - Assessoria Judicial TRT12

let dadosTST = {
    sumulas: [],
    ojs: [],
    precedentes: []
};

let todosItens = [];
let itensFiltrados = [];
let favoritos = [];
let informativos = [];
let viewMode = 'grid';
let searchTerm = '';

// Carregar dados do localStorage ou inicializar
function carregarDados() {
    const favoritosSalvos = localStorage.getItem('juristst_favoritos');
    if (favoritosSalvos) {
        favoritos = JSON.parse(favoritosSalvos);
    }
    
    const informativosSalvos = localStorage.getItem('juristst_informativos');
    if (informativosSalvos) {
        informativos = JSON.parse(informativosSalvos);
        renderizarInformativos();
    }
    
    // Carregar dados da jurisprudência
    carregarJurisprudencia();
}

async function carregarJurisprudencia() {
    try {
        const response = await fetch('dados_tst.json');
        dadosTST = await response.json();
        
        // Combinar todos os itens em um array único
        todosItens = [
            ...dadosTST.sumulas.map(item => ({...item, tipo: 'Súmula'})),
            ...dadosTST.ojs.map(item => ({...item, tipo: 'OJ'})),
            ...dadosTST.precedentes.map(item => ({...item, tipo: 'Precedente Normativo'}))
        ];
        
        // Adicionar ID único para cada item
        todosItens = todosItens.map((item, index) => ({
            ...item,
            id: `${item.tipo.toLowerCase().replace(/\s+/g, '_')}_${item.numero}`,
            index: index
        }));
        
        itensFiltrados = [...todosItens];
        renderizarResultados();
        
        console.log(`✅ ${todosItens.length} itens carregados`);
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        document.querySelector('.content').innerHTML = `
            <div class="empty-state">
                <h3>⚠️ Erro ao carregar dados</h3>
                <p>Por favor, certifique-se de que o arquivo dados_tst.json está disponível.</p>
                <p style="color: red; font-size: 0.9em; margin-top: 10px;">${error.message}</p>
            </div>
        `;
    }
}

// Busca e filtros
function realizarBusca() {
    searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const tipoFiltro = document.getElementById('filterTipo').value;
    const orgaoFiltro = document.getElementById('filterOrgao').value;
    const numeroFiltro = document.getElementById('filterNumero').value.trim();
    
    itensFiltrados = todosItens.filter(item => {
        // Filtro de tipo
        if (tipoFiltro !== 'todos' && item.tipo !== tipoFiltro) return false;
        
        // Filtro de órgão (apenas para OJs)
        if (orgaoFiltro !== 'todos' && item.tipo === 'OJ') {
            if (!item.orgao || !item.orgao.includes(orgaoFiltro)) return false;
        }
        
        // Filtro de número
        if (numeroFiltro && item.numero !== numeroFiltro) return false;
        
        // Busca textual
        if (searchTerm) {
            const textoCompleto = `${item.numero} ${item.titulo} ${item.texto}`.toLowerCase();
            const termos = searchTerm.split(' ').filter(t => t.length > 2);
            
            // Todos os termos devem estar presentes
            return termos.every(termo => textoCompleto.includes(termo));
        }
        
        return true;
    });
    
    renderizarResultados();
}

// Renderização
function renderizarResultados() {
    const content = document.querySelector('.content');
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
        const badgeClass = item.tipo === 'Súmula' ? 'badge-sumula' : 
                          item.tipo === 'OJ' ? 'badge-oj' : 'badge-precedente';
        
        const isFavorito = favoritos.includes(item.id);
        const favoritoClass = isFavorito ? 'active' : '';
        const favoritoIcon = isFavorito ? '⭐' : '☆';
        
        const orgaoInfo = item.orgao ? ` - ${item.orgao}` : '';
        
        // Destacar termos de busca no título
        let tituloExibido = item.titulo;
        if (searchTerm) {
            const termos = searchTerm.split(' ').filter(t => t.length > 2);
            termos.forEach(termo => {
                const regex = new RegExp(`(${termo})`, 'gi');
                tituloExibido = tituloExibido.replace(regex, '<span class="highlight">$1</span>');
            });
        }
        
        html += `
            <div class="card" onclick="abrirDetalhes('${item.id}')">
                <div class="card-header">
                    <div class="card-number">#${item.numero}</div>
                    <div class="card-badge ${badgeClass}">${item.tipo}${orgaoInfo}</div>
                </div>
                <div class="card-title">${tituloExibido}</div>
                <div class="card-preview">${item.texto.substring(0, 150)}...</div>
                <div class="card-actions">
                    <button class="btn-action btn-favorite ${favoritoClass}" 
                            onclick="event.stopPropagation(); toggleFavorito('${item.id}')">
                        ${favoritoIcon} Favorito
                    </button>
                    <button class="btn-action btn-share" 
                            onclick="event.stopPropagation(); compartilhar('${item.id}')">
                        🔗 Compartilhar
                    </button>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    content.innerHTML = html;
}

function abrirDetalhes(itemId) {
    const item = todosItens.find(i => i.id === itemId);
    if (!item) return;
    
    const modal = document.getElementById('detailModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMeta = document.getElementById('modalMeta');
    const modalText = document.getElementById('modalText');
    
    const orgaoInfo = item.orgao ? ` | ${item.orgao}` : '';
    
    modalTitle.textContent = `${item.tipo} nº ${item.numero}`;
    modalMeta.textContent = `${item.cabecalho || ''}${orgaoInfo}`;
    
    // Destacar termos de busca no texto
    let textoExibido = item.texto;
    if (searchTerm) {
        const termos = searchTerm.split(' ').filter(t => t.length > 2);
        termos.forEach(termo => {
            const regex = new RegExp(`(${termo})`, 'gi');
            textoExibido = textoExibido.replace(regex, '<span class="highlight">$1</span>');
        });
    }
    
    modalText.innerHTML = textoExibido;
    modal.classList.add('active');
    
    // Registrar visualização
    registrarVisualizacao(itemId);
}

function closeModal() {
    document.getElementById('detailModal').classList.remove('active');
}

function toggleFavorito(itemId) {
    const index = favoritos.indexOf(itemId);
    if (index === -1) {
        favoritos.push(itemId);
    } else {
        favoritos.splice(index, 1);
    }
    
    localStorage.setItem('juristst_favoritos', JSON.stringify(favoritos));
    renderizarResultados();
    
    if (document.getElementById('tab-favoritos').style.display !== 'none') {
        renderizarFavoritos();
    }
}

function compartilhar(itemId) {
    const item = todosItens.find(i => i.id === itemId);
    if (!item) return;
    
    const texto = `${item.tipo} nº ${item.numero} - TST\n\n${item.titulo.substring(0, 200)}...\n\nVia JurisTST`;
    
    if (navigator.share) {
        navigator.share({
            title: `${item.tipo} ${item.numero}`,
            text: texto
        });
    } else {
        // Copiar para clipboard
        navigator.clipboard.writeText(texto).then(() => {
            alert('✅ Texto copiado para a área de transferência!');
        });
    }
}

function registrarVisualizacao(itemId) {
    const visualizacoes = JSON.parse(localStorage.getItem('juristst_visualizacoes') || '{}');
    visualizacoes[itemId] = (visualizacoes[itemId] || 0) + 1;
    localStorage.setItem('juristst_visualizacoes', JSON.stringify(visualizacoes));
}

// Gestão de abas
function showTab(tabName) {
    // Atualizar abas
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
    
    // Atualizar conteúdo
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) {
        targetTab.style.display = 'block';
    }
    
    // Renderizar conteúdo específico
    if (tabName === 'favoritos') {
        renderizarFavoritos();
    } else if (tabName === 'informativos') {
        renderizarInformativos();
    }
}

function renderizarFavoritos() {
    const favoritosContent = document.getElementById('favoritosContent');
    
    if (favoritos.length === 0) {
        favoritosContent.innerHTML = `
            <div class="empty-state">
                <h3>⭐ Nenhum favorito ainda</h3>
                <p>Adicione jurisprudências aos favoritos para acesso rápido</p>
            </div>
        `;
        return;
    }
    
    const itensFavoritos = todosItens.filter(item => favoritos.includes(item.id));
    
    let html = '<div class="results-list">';
    itensFavoritos.forEach(item => {
        const badgeClass = item.tipo === 'Súmula' ? 'badge-sumula' : 
                          item.tipo === 'OJ' ? 'badge-oj' : 'badge-precedente';
        
        html += `
            <div class="card" onclick="abrirDetalhes('${item.id}')">
                <div class="card-header">
                    <div class="card-number">#${item.numero}</div>
                    <div class="card-badge ${badgeClass}">${item.tipo}</div>
                </div>
                <div class="card-title">${item.titulo}</div>
                <div class="card-preview">${item.texto.substring(0, 150)}...</div>
                <div class="card-actions">
                    <button class="btn-action btn-favorite active" 
                            onclick="event.stopPropagation(); toggleFavorito('${item.id}')">
                        ⭐ Remover
                    </button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    favoritosContent.innerHTML = html;
}

function renderizarInformativos() {
    const informativosList = document.getElementById('informativosList');
    
    if (informativos.length === 0) {
        informativosList.innerHTML = `
            <div class="empty-state">
                <p>Nenhum informativo adicionado ainda</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    informativos.forEach((inf, index) => {
        html += `
            <div class="informativo-item">
                <h3>📄 ${inf.nome}</h3>
                <p style="color: #7f8c8d; font-size: 0.9em;">
                    Adicionado em ${new Date(inf.data).toLocaleDateString('pt-BR')}
                    | Tamanho: ${(inf.tamanho / 1024).toFixed(2)} KB
                </p>
                <div style="margin-top: 15px;">
                    <button class="btn-action btn-share" onclick="visualizarInformativo(${index})">
                        👁️ Visualizar
                    </button>
                    <button class="btn-action" style="background: #e74c3c; color: white;" 
                            onclick="removerInformativo(${index})">
                        🗑️ Remover
                    </button>
                </div>
            </div>
        `;
    });
    
    informativosList.innerHTML = html;
}

function setView(mode) {
    viewMode = mode;
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderizarResultados();
}

// Upload de informativos
function inicializarUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
    
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
}

function handleFiles(files) {
    Array.from(files).forEach(file => {
        if (file.type === 'application/pdf') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const informativo = {
                    nome: file.name,
                    data: new Date().toISOString(),
                    tamanho: file.size,
                    conteudo: e.target.result
                };
                
                informativos.push(informativo);
                localStorage.setItem('juristst_informativos', JSON.stringify(informativos));
                renderizarInformativos();
                
                alert(`✅ ${file.name} adicionado com sucesso!`);
            };
            reader.readAsDataURL(file);
        } else {
            alert('⚠️ Apenas arquivos PDF são aceitos');
        }
    });
}

function visualizarInformativo(index) {
    const inf = informativos[index];
    const pdfWindow = window.open('', '_blank');
    pdfWindow.document.write(`
        <html>
            <head>
                <title>${inf.nome}</title>
                <style>
                    body { margin: 0; padding: 0; }
                    iframe { width: 100%; height: 100vh; border: none; }
                </style>
            </head>
            <body>
                <iframe src="${inf.conteudo}"></iframe>
            </body>
        </html>
    `);
}

function removerInformativo(index) {
    if (confirm('Tem certeza que deseja remover este informativo?')) {
        informativos.splice(index, 1);
        localStorage.setItem('juristst_informativos', JSON.stringify(informativos));
        renderizarInformativos();
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    carregarDados();
    inicializarUpload();
    
    // Busca
    document.getElementById('searchInput').addEventListener('input', realizarBusca);
    document.getElementById('filterTipo').addEventListener('change', realizarBusca);
    document.getElementById('filterOrgao').addEventListener('change', realizarBusca);
    document.getElementById('filterNumero').addEventListener('input', realizarBusca);
    
    // Fechar modal ao clicar fora
    document.getElementById('detailModal').addEventListener('click', (e) => {
        if (e.target.id === 'detailModal') {
            closeModal();
        }
    });
    
    // Pills de filtro
    document.querySelectorAll('.pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            
            const view = pill.dataset.view;
            if (view === 'recentes') {
                // Ordenar por visualizações
                const visualizacoes = JSON.parse(localStorage.getItem('juristst_visualizacoes') || '{}');
                itensFiltrados.sort((a, b) => {
                    return (visualizacoes[b.id] || 0) - (visualizacoes[a.id] || 0);
                });
            } else {
                realizarBusca();
            }
            renderizarResultados();
        });
    });
});

// Atalhos de teclado
document.addEventListener('keydown', (e) => {
    // ESC para fechar modal
    if (e.key === 'Escape') {
        closeModal();
    }
    
    // CTRL/CMD + K para focar na busca
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
    }
});

console.log('🚀 JurisTST inicializado - Sistema desenvolvido para estudos de Direito do Trabalho');
