// Tipos de autenticação, usuários e perfis de acesso (SIGEF-ME)

export interface Usuario {
  id: string
  nome: string
  login: string // nome de usuário único (lowercase)
  senhaHash: string // SHA-256 via Web Crypto — nunca texto puro
  perfilId: string
  ativo: boolean
  criadoEm: string
  atualizadoEm: string
  ultimoLogin?: string
}

export interface Perfil {
  id: string
  nome: string
  descricao: string
  permissoes: string[] // chaves de TELAS + ACOES (ver abaixo)
  sistema: boolean // criado automaticamente no onboarding (Administrador não editável)
  atualizadoEm: string
}

export interface Sessao {
  usuarioId: string
  nome: string
  login: string
  perfilId: string
  iniciadaEm: string
}

/** Catálogo de telas protegidas por permissão (rota → chave). */
export const TELAS: {
  key: string
  rota: string
  label: string
  grupo: 'Operacional' | 'Fiscal' | 'Sistema'
}[] = [
  { key: 'tela-painel', rota: '/', label: 'Painel', grupo: 'Operacional' },
  { key: 'tela-importar', rota: '/importar', label: 'Importar', grupo: 'Operacional' },
  { key: 'tela-kardex', rota: '/kardex', label: 'Kardex', grupo: 'Operacional' },
  { key: 'tela-inventario', rota: '/inventario', label: 'Inventário', grupo: 'Operacional' },
  { key: 'tela-bloco-k', rota: '/bloco-k', label: 'Bloco K', grupo: 'Operacional' },
  { key: 'tela-sped', rota: '/sped', label: 'SPED TXT', grupo: 'Operacional' },
  { key: 'tela-produtos', rota: '/produtos', label: 'Produtos (De-Para)', grupo: 'Operacional' },
  { key: 'tela-fornecedores', rota: '/fornecedores', label: 'Fornecedores', grupo: 'Fiscal' },
  { key: 'tela-regras-cfop', rota: '/regras-cfop', label: 'Regras CFOP', grupo: 'Fiscal' },
  { key: 'tela-empresas', rota: '/empresas', label: 'Empresas', grupo: 'Fiscal' },
  { key: 'tela-sefaz', rota: '/sefaz', label: 'SEFAZ por Estado', grupo: 'Fiscal' },
  { key: 'tela-auditoria', rota: '/auditoria', label: 'Auditoria', grupo: 'Fiscal' },
  { key: 'tela-reforma', rota: '/reforma', label: 'Reforma Tributária', grupo: 'Fiscal' },
  { key: 'tela-assistente', rota: '/assistente', label: 'Assistente IA', grupo: 'Fiscal' },
  { key: 'tela-backup', rota: '/backup', label: 'Backup', grupo: 'Sistema' },
  { key: 'tela-certificado', rota: '/certificado', label: 'Certificado Digital', grupo: 'Sistema' },
  { key: 'tela-manuais', rota: '/manuais', label: 'Manuais', grupo: 'Sistema' },
  { key: 'tela-verificacao', rota: '/verificacao', label: 'Verificação (Lupo)', grupo: 'Sistema' },
  { key: 'tela-configuracoes', rota: '/configuracoes', label: 'Configurações', grupo: 'Sistema' },
  { key: 'tela-usuarios', rota: '/usuarios', label: 'Usuários', grupo: 'Sistema' },
  { key: 'tela-perfis', rota: '/perfis', label: 'Perfis de acesso', grupo: 'Sistema' },
]

/** Catálogo de ações sensíveis (exibidas na matriz de permissões). */
export const ACOES: { key: string; label: string; descricao: string }[] = [
  {
    key: 'acao-processar-notas',
    label: 'Processar notas',
    descricao: 'Importar XMLs, cancelar NF-e, reprocessar Kardex e salvar De-Para',
  },
  {
    key: 'acao-aprovar-ajuste',
    label: 'Aprovar ajuste de inventário',
    descricao: 'Aprovar/rejeitar divergências da contagem física',
  },
  {
    key: 'acao-fechar-competencia',
    label: 'Fechar competência',
    descricao: 'Encerrar competência com Bloco H e K totalizados',
  },
  {
    key: 'acao-excluir-registros',
    label: 'Excluir registros',
    descricao: 'Excluir produtos, vínculos de-para, regras CFOP e fornecedores',
  },
  {
    key: 'acao-backup-restaurar',
    label: 'Backup e restauração',
    descricao: 'Gerar, importar e restaurar backups do sistema',
  },
  {
    key: 'acao-gerenciar-usuarios',
    label: 'Gerenciar usuários',
    descricao: 'Criar, editar, ativar/desativar usuários e redefinir senhas',
  },
  {
    key: 'acao-gerenciar-perfis',
    label: 'Gerenciar perfis',
    descricao: 'Editar a matriz de permissões dos perfis de acesso',
  },
  {
    key: 'acao-criar-produto',
    label: 'Criar produto via planilha',
    descricao: 'Importar cadastro de itens de planilha (XLSX/CSV) para o catálogo e inventário',
  },
]

export const TODAS_PERMISSOES = [...TELAS.map((t) => t.key), ...ACOES.map((a) => a.key)]

/** Mapa rota → tela, para o guard de rotas e o menu lateral. */
export const TELA_POR_ROTA: Record<string, (typeof TELAS)[number]> = Object.fromEntries(
  TELAS.map((t) => [t.rota, t]),
)

/** Perfis padrão criados no primeiro acesso (onboarding do administrador). */
export function montarPerfisPadrao(agora: string): Perfil[] {
  const todas = [...TODAS_PERMISSOES]
  return [
    {
      id: 'perfil-administrador',
      nome: 'Administrador',
      descricao: 'Acesso total ao sistema, incluindo usuários e perfis',
      permissoes: todas,
      sistema: true,
      atualizadoEm: agora,
    },
    {
      id: 'perfil-fiscal',
      nome: 'Fiscal',
      descricao: 'Operação fiscal completa, sem gestão de usuários e perfis',
      permissoes: todas.filter(
        (p) =>
          ![
            'tela-usuarios',
            'tela-perfis',
            'acao-gerenciar-usuarios',
            'acao-gerenciar-perfis',
          ].includes(p),
      ),
      sistema: true,
      atualizadoEm: agora,
    },
    {
      id: 'perfil-operacional',
      nome: 'Operacional',
      descricao: 'Estoque e kardex, sem fechamento de competência nem sistema',
      permissoes: [
        'tela-painel',
        'tela-importar',
        'tela-kardex',
        'tela-produtos',
        'tela-manuais',
        'acao-processar-notas',
        'acao-excluir-registros',
      ],
      sistema: true,
      atualizadoEm: agora,
    },
    {
      id: 'perfil-consulta',
      nome: 'Consulta',
      descricao: 'Somente visualização de painel, kardex e relatórios',
      permissoes: ['tela-painel', 'tela-kardex', 'tela-sped', 'tela-manuais'],
      sistema: true,
      atualizadoEm: agora,
    },
  ]
}
