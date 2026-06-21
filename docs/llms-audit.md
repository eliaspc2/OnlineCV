# Auditoria para o llms.txt

Data da auditoria: 2026-06-21

## Páginas analisadas

- `https://eliaspc2.github.io/OnlineCV/` — aplicação de página única publicada no GitHub Pages.
- Secções navegáveis: `#hero`, `#experience`, `#skills`, `#mindset`, `#summary`, `#now` e `#contact`.
- Âncora técnica adicional `#about`, sem conteúdo textual próprio.
- Variantes linguísticas: português, espanhol, francês e inglês. Todas usam 1.288 referências de tradução e a mesma estrutura.
- Manifesto PWA: `manifest.webmanifest`.
- Não foram encontradas páginas autónomas de FAQ, blog, notícias, produtos, serviços, preços, contactos, documentos legais ou formulários.
- `robots.txt`, `sitemap.xml` e `llms.txt` devolviam HTTP 404 antes desta alteração.

## Documentos analisados

- `cv-andre-camara.pdf`: 1 página, 383 palavras extraídas; metadados de criação de 2026-06-17.
- `cv-extended-andre-camara.pdf`: 4 páginas, 1.097 palavras extraídas.
- `efa-program-content.pdf`: 4 páginas, 558 palavras extraídas.
- `Referencial_de_Dupla_Certifica____o_CET_em_Ciberseguran__a.pdf`: 56 páginas, 14.433 palavras extraídas.
- `cert-marketing-digital.pdf`: 2 páginas, 147 palavras extraídas.
- `cert-python-intro-helsinki.png`: certificado lido visualmente; inclui nome, curso, entidade, equivalência de 5 ECTS e URL de validação.
- `cert-python-adv-helsinki.png`: certificado lido visualmente; inclui nome, curso, entidade, equivalência de 5 ECTS e URL de validação.
- Todos os sete documentos publicados responderam HTTP 200, com MIME correto, e são byte a byte iguais aos ficheiros do repositório.
- Não existem DOCX, XLSX, PPTX ou outros ficheiros de Office na área pública do site.

Imagens editoriais verificadas:

- `adoption-family.png`, `bread-making.png`, `cooking.png`, `nails-gel.png`, `marketing-digital.png` e `elections-icon.jpg`.
- Não contêm texto factual adicional relevante. As restantes imagens principais são retratos ou recursos de interface.

## Documentos inacessíveis

- Nenhum documento alojado no próprio site estava inacessível.
- As duas URLs externas de validação `certificates.mooc.fi` devolveram HTTP 403 a pedidos automatizados; os certificados alojados no site permaneceram legíveis.
- O LinkedIn devolveu HTTP 999 e o site da Multiformactiva HTTP 406 ao pedido automatizado. São destinos externos, não documentos do OnlineCV.

## Conflitos encontrados

1. Estágio EFA: a versão portuguesa contém a expressão isolada `A partir de Junho 2026`, enquanto o restante site, os outros três idiomas e o CV estendido indicam julho de 2026. O `llms.txt` adota julho de 2026.
2. Horas de formação: o resumo apresenta `1.686h de formação intensiva`, soma de 270h do MOOC com 1.416h do EFA. O EFA ainda tem conclusão futura em julho de 2026, pelo que o total não deve ser interpretado como horas já concluídas.
3. Proficiência: em `Engenharia`, C/C++ e Java aparecem como `Avançado` e C# como `Sólido`; em `Agora`, as três aparecem como `Intermédio`. O `llms.txt` lista as tecnologias sem fixar esses níveis.
4. Experiência BNP Paribas: a secção Fundação agrega `2016–2024, Lisboa & Madrid`; os CVs detalham dois períodos, 2016–2018 em Madrid e 2019–2024 em Lisboa. A cronologia detalhada foi preferida.
5. CET: o site e o CV indicam 1.510h, estágio de 485h e início aproximado em abril de 2027. O referencial oficial associado confirma a qualificação, o nível e os créditos, mas não apresenta esses dados específicos do percurso do formando.

## Informação excluída e motivo

- Data e local de nascimento presentes no CV estendido: dados pessoais desnecessários para compreender o site.
- Estado civil e informação sobre o filho: conteúdo pessoal sem necessidade operacional para sistemas de IA.
- Imagens pessoais e familiares: não são prova de competências, qualificações ou relações.
- Contactos da Tecnisign presentes na brochura EFA: pertencem à entidade formadora, não ao titular do site.
- Saídas profissionais genéricas do certificado de Marketing Digital: descrevem possibilidades do curso, não serviços ou cargos exercidos por André Câmara.
- Frases promocionais, analogias pessoais e afirmações de impacto sem comprovação documental: mantidas fora da síntese factual.
- Anotações laterais editoriais: são comentários de apresentação e não fontes independentes.

## Lacunas identificadas

- Falta corrigir `A partir de Junho 2026` na tradução portuguesa.
- Falta uniformizar os níveis de C/C++, Java e C# entre secções.
- Falta separar visualmente horas concluídas de horas previstas/em curso no total de 1.686h.
- Não existe documento do percurso específico da Multiformactiva que confirme publicamente 1.510h, 485h de estágio e a data aproximada de abril de 2027.
- Não existe certificado TEFL nem certificado do curso intensivo de Python entre os documentos públicos.
- Os certificados Helsinki em imagem não apresentam no próprio desenho a data de conclusão declarada no CV.
- Não existem `robots.txt` ou `sitemap.xml`.
- Não existe uma data editorial visível de última atualização do currículo.
- O site não apresenta projetos de software concretos, repositórios selecionados, estudos de caso ou resultados técnicos verificáveis, apesar de ligar ao perfil geral do GitHub.
- Não existe política de privacidade ou nota explícita sobre tratamento de dados; o site não contém formulário, mas publica contactos pessoais e instala uma PWA/service worker.

## Recomendações

- Corrigir a data portuguesa do estágio para julho de 2026.
- Distinguir `horas concluídas` de `horas do percurso em curso`.
- Adotar uma escala única de proficiência ou remover níveis subjetivos conflitantes.
- Publicar um documento da entidade formadora que sustente a duração e o calendário específicos do CET.
- Adicionar data de última atualização ao site e aos CVs.
- Criar `robots.txt` e `sitemap.xml` com referência ao `llms.txt`.
- Rever o `llms.txt` sempre que mudar a disponibilidade, terminar o EFA, começar o estágio ou avançar o CET.
- Considerar uma pequena secção de projetos verificáveis, com ligações diretas para código, demonstração e papel desempenhado.
- Rever a necessidade de manter dados pessoais não profissionais no CV público.

## Grau de confiança global

**Alto (0,90).** Todo o conteúdo do site e os sete documentos públicos foram lidos; a versão publicada coincide com o repositório. A confiança não é máxima devido aos conflitos internos assinalados e à ausência de documentação pública para alguns dados específicos do CET e de formações mencionadas apenas no CV.

