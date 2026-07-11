
# 11. Esquema de Criação de Branch e Commits

As **branches sempre devem ser criadas a partir da `master`**, que é a branch principal do projeto.
Após o desenvolvimento, o **Pull Request deve ser aberto para a branch `development`**, que representa o ambiente de **homologação**.



## Padrão de Branch

Formato:

```
feature/descricao-da-branch
```

Exemplo:

```
feature/bradesco-add-new-page
```

Regras:

- Utilizar **kebab-case** na descrição
- O nome da branch deve descrever claramente a alteração
- A branch é criada a partir da **`master`**
- O **Pull Request deve ser aberto para `master`**



## Padrão de Commit

Formato:

```
**AÇÃO:** descrição do commit
```

Exemplo:

```
**Add:** Open Modal
```

Ações utilizadas no projeto:

| Ação     | Descrição                                        |
| -------- | ------------------------------------------------ |
| Feature  | Nova funcionalidade                              |
| Add      | Adição de código                                 |
| Mod      | Modificação de código                            |
| Fix      | Correção de bug                                  |
| Del      | Remoção de código                                |
| Rename   | Renomeação de arquivos                           |
| Mov      | Movimentação de arquivos                         |
| Refactor | Refatoração sem alterar comportamento            |
| Style    | Ajustes de formatação/estilo (sem lógica)        |
| Docs     | Alterações em documentação                       |
| Test     | Adição ou ajuste de testes                       |
| Chore    | Tarefas de manutenção (build, dependências, etc) |
| Perf     | Melhoria de performance                          |

Regras:

- Cada commit deve representar **uma alteração clara**
- A mensagem deve descrever **o que foi feito**
- Evitar commits genéricos como `update`, `ajustes` ou `wip`

Dessa forma, cada alteração no código fica **descrita de forma clara**, facilitando auditoria, revisão de código e histórico do projeto.



## 11.2 Fluxo Recomendado

1. Atualizar branch base local:

```bash
git checkout master
git pull origin master
```

2. Criar branch de trabalho:

```bash
git checkout -b feature/descricao-da-feature
```

3. Commits pequenos e frequentes (uma intenção por commit)

4. Abrir Pull Request para `development`

5. Após aprovação e merge, apagar branch:

```bash
git branch -d feature/nome-da-feature
git push origin --delete feature/nome-da-feature
```



## 11.3 Checklist Antes do Commit

- Código compila sem erro
- Lint sem erros críticos
- Tipagem sem regressão (`any` apenas quando justificado)
- Mudança respeita responsabilidade da pasta
- Arquivos da tela permanecem encapsulados no módulo da tela
- Não incluir arquivos sensíveis (`.env`, chaves, credenciais)

---

## 11.4 Pull Request: padrão mínimo

Todo PR deve conter:

- Contexto (problema/oportunidade)
- O que foi alterado
- Evidências quando necessário (print, vídeo, logs)

Template sugerido:

```md
## Contexto

-

## O que foi feito

-

## Checklist

- [ ] Build local ok
- [ ] Lint ok
```

Exemplo de uso:

```md
## Contexto

A página inicial do Bradesco não possuía um componente de destaque configurável
pelo autor no AEM, exigindo alteração de código para cada campanha.

## O que foi feito

- Criado o componente `hero-banner` no AEM com diálogo de autoria
- Adicionada a policy do componente ao template da home
- Incluídos estilos responsivos no client library

## Checklist

- [x] Build local ok
- [x] Lint ok
```


