# Auditoria para o llms.txt

Data da auditoria: 2026-08-14

## Páginas analisadas

- `https://eliaspc2.github.io/OnlineCV/` — aplicação de página única publicada no GitHub Pages.
- Secções navegáveis: `#hero`, `#experience`, `#skills`, `#mindset`, `#summary`, `#now` e `#contact`.
- Âncora técnica adicional `#about`, sem conteúdo textual próprio.
- Variantes linguísticas: português, espanhol, francês e inglês. Todas usam 1.288 referências de tradução e a mesma estrutura.
- Manifesto PWA: `manifest.webmanifest`.
- Não foram encontradas páginas autónomas de FAQ, blog, notícias, produtos, serviços, preços, contactos, documentos legais ou formulários.
- `robots.txt`, `sitemap.xml` e `llms.txt` devolviam HTTP 404 antes desta alteração.

## Documentos analisados

- `cv-andre-camara.pdf`: 1 página, 372 palavras extraídas; metadados de criação de 2026-08-14.
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

1. Posicionamento profissional: a página atual e o CV Padrão atualizado procuram trabalho como Junior Python Developer e apresentam a formação em cibersegurança como reforço. O CV Estendido, anterior a esta mudança, ainda diz que o estágio EFA estava agendado para julho de 2026. Para disponibilidade atual, a página viva e o CV Padrão mais recente foram preferidos.
2. Estado do EFA: o CV Padrão criado em 14 de agosto de 2026 declara o EFA concluído, enquanto alguns textos da página continuam a mostrar `conclusão em julho de 2026`. O documento oficial mais recente foi preferido para o estado da formação, mantendo a discrepância assinalada.
3. Horas de formação: o resumo apresenta `1.686h de formação intensiva`, soma de 270h do MOOC com 1.416h do EFA. Esse total não inclui as 1.510h do CET em curso.
4. Proficiência: em `Engenharia`, C/C++ e Java aparecem como `Avançado` e C# como `Sólido`; em `Agora`, as três aparecem como `Intermédio`. O `llms.txt` lista as tecnologias sem fixar esses níveis.
5. Experiência BNP Paribas: a secção Fundação agrega `2016–2024, Lisboa & Madrid`; os CVs detalham dois períodos, 2016–2018 em Madrid e 2019–2024 em Lisboa. A cronologia detalhada foi preferida.
6. CET: o site e o CV indicam 1.510h, estágio de 485h e início aproximado em abril de 2027. O referencial oficial associado confirma a qualificação, o nível e os créditos, mas não apresenta esses dados específicos do percurso do formando.

## Informação excluída e motivo

- Data e local de nascimento presentes no CV estendido: dados pessoais desnecessários para compreender o site.
- Estado civil e informação sobre o filho: conteúdo pessoal sem necessidade operacional para sistemas de IA.
- Imagens pessoais e familiares: não são prova de competências, qualificações ou relações.
- Contactos da Tecnisign presentes na brochura EFA: pertencem à entidade formadora, não ao titular do site.
- Saídas profissionais genéricas do certificado de Marketing Digital: descrevem possibilidades do curso, não serviços ou cargos exercidos por André Câmara.
- Frases promocionais, analogias pessoais e afirmações de impacto sem comprovação documental: mantidas fora da síntese factual.
- Anotações laterais editoriais: são comentários de apresentação e não fontes independentes.

## Lacunas identificadas

- O CV Estendido ainda não foi reeditado depois do fim da campanha de estágio e mantém referências temporais antigas.
- Alguns textos da página ainda apresentam o EFA apenas com `conclusão em julho de 2026`, enquanto o CV Padrão atualizado declara a formação concluída.
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

- Atualizar o CV Estendido para refletir o posicionamento atual como Junior Python Developer e remover formulações futuras já ultrapassadas.
- Uniformizar na página o estado do EFA com o CV Padrão atualizado.
- Distinguir `horas concluídas` de `horas do percurso em curso`.
- Adotar uma escala única de proficiência ou remover níveis subjetivos conflitantes.
- Publicar um documento da entidade formadora que sustente a duração e o calendário específicos do CET.
- Adicionar data de última atualização ao site e aos CVs.
- Criar `robots.txt` e `sitemap.xml` com referência ao `llms.txt`.
- Rever o `llms.txt` sempre que mudar a disponibilidade, terminar o EFA, começar o estágio ou avançar o CET.
- Considerar uma pequena secção de projetos verificáveis, com ligações diretas para código, demonstração e papel desempenhado.
- Rever a necessidade de manter dados pessoais não profissionais no CV público.

## Grau de confiança global

**Alto (0,91).** Todo o conteúdo do site e os sete documentos públicos foram lidos. A confiança não é máxima devido à diferença temporal entre alguns textos da página e o CV Padrão, ao CV Estendido ainda desatualizado, aos conflitos internos assinalados e à ausência de documentação pública para alguns dados específicos do CET e de formações mencionadas apenas no CV.
