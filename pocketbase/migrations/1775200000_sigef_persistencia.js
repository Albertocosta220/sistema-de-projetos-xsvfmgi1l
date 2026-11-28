/// <reference path="../pb_data/types.d.ts" />

/**
 * SIGEF-ME — coleções de persistência no PocketBase (Skip Cloud).
 *
 * Esquema em formato "documento": cada linha carrega o registro fiscal
 * serializado em dadosJson (texto ilimitado) + campos-chave para busca/índice.
 * Coleções:
 *   empresas       — cadastro de empresas (dadosJson = objeto Empresa)
 *   usuarios       — usuários do login local (dadosJson = Usuario, hash SHA-256)
 *   perfis         — perfis de acesso e permissões (dadosJson = Perfil)
 *   empresa_stores — escrituração completa da empresa: produtos, de-para,
 *                    documentos fiscais (itens/emitente/valores), kardex,
 *                    fechamentos/inventário, ocorrências A01–A13, regras de
 *                    desqualificação/não-vincula-estoque e consultas DF-e
 *                    (dadosJson = DadosEmpresaStore, isolado por empresaId)
 *   kv_sigef       — configurações do sistema, regras CFOP, certificado A1 e
 *                    histórico de backups (chave → valorJson)
 * Regras: vazias ("") = acesso público pela SPA do mesmo endereço; o
 * endurecimento para coleção autenticada fica pendente de decisão do usuário.
 */
migrate(
  (app) => {
    const criarSeNaoExiste = (definicao) => {
      try {
        app.findCollectionByNameOrId(definicao.name)
        return // já existe: não cria de novo (migration idempotente)
      } catch {
        // não existe: segue para criar
      }
      app.save(new Collection(definicao))
    }

    criarSeNaoExiste({
      name: 'empresas',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'localId', type: 'text', required: true },
        { name: 'cnpj', type: 'text' },
        { name: 'nomeFantasia', type: 'text' },
        { name: 'razaoSocial', type: 'text' },
        { name: 'dadosJson', type: 'text' },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_empresas_local_id ON empresas (localId)'],
    })

    criarSeNaoExiste({
      name: 'usuarios',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'login', type: 'text', required: true },
        { name: 'nome', type: 'text' },
        { name: 'perfilId', type: 'text' },
        { name: 'ativo', type: 'bool' },
        { name: 'dadosJson', type: 'text' },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_usuarios_login ON usuarios (login)'],
    })

    criarSeNaoExiste({
      name: 'perfis',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'descricao', type: 'text' },
        { name: 'sistema', type: 'bool' },
        { name: 'dadosJson', type: 'text' },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_perfis_nome ON perfis (nome)'],
    })

    criarSeNaoExiste({
      name: 'empresa_stores',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'empresaId', type: 'text', required: true },
        { name: 'dadosJson', type: 'text' },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_empresa_stores_empresa ON empresa_stores (empresaId)'],
    })

    criarSeNaoExiste({
      name: 'kv_sigef',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'chave', type: 'text', required: true },
        { name: 'valorJson', type: 'text' },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_kv_sigef_chave ON kv_sigef (chave)'],
    })
  },
  (app) => {
    ;['empresas', 'usuarios', 'perfis', 'empresa_stores', 'kv_sigef'].forEach((nome) => {
      try {
        app.delete(app.findCollectionByNameOrId(nome))
      } catch {
        // já removida (down idempotente)
      }
    })
  },
)
