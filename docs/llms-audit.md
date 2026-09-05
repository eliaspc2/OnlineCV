# Auditoria para o llms.txt

Data da última revisão incremental: 2026-09-05

Esta revisão acrescenta o programa de Ciência de Dados, verifica a sua apresentação nas quatro línguas e atualiza o llms.txt. As observações sobre os restantes documentos provêm da auditoria anterior. O titular pediu expressamente que não se atribuísse nível 5 ao novo curso, pois a realização de estágio não está decidida.

Antes da publicação foram integrados os três commits remotos de 22 de agosto de 2026, preservando o posicionamento em cibersegurança e a conclusão do EFA em agosto. O CV Padrão remoto foi novamente lido integralmente. Foi corrigida nas quatro línguas a etiqueta `obj.n_72cd9d68`: Python tinha sido substituído incorretamente por Cibersegurança na lista de linguagens. As observações abaixo substituem os resultados anteriores quando há informação mais recente.

Validação incremental: build aprovado; browser headless a 320, 390 e 1920 px nas quatro línguas, sem erros de consola nem overflow no novo cartão; abertura/fecho do cartão e visualizador PDF verificados. O novo PDF responde HTTP 200 e coincide com o original. Aos 320 px subsiste overflow global de 384 px, reproduzido também com a configuração anterior, em decorações e contactos fora do novo curso.

## Páginas analisadas

- `https://eliaspc2.github.io/OnlineCV/` — aplicação de página única publicada no GitHub Pages.
- Secções navegáveis: `#hero`, `#experience`, `#skills`, `#mindset`, `#summary`, `#now` e `#contact`.
- Âncora técnica adicional `#about`, sem conteúdo textual próprio.
- Variantes linguísticas: português, espanhol, francês e inglês, com a mesma estrutura e traduções do novo curso.
- Manifesto PWA: `manifest.webmanifest`.
- Não foram encontradas páginas autónomas de FAQ, blog, notícias, produtos, serviços, preços, contactos, documentos legais ou formulários.
- `robots.txt`, `sitemap.xml` e `llms.txt` devolviam HTTP 404 antes desta alteração.

## Documentos analisados

- `data-science-program-content.pdf`: 4 páginas, brochura Tecnisign criada em 2026-04-14; texto integral lido. Contém 30 UFCD, cuja soma é 1.000 horas, e metodologia e-learning com atividades assíncronas e sessões síncronas. Início em 2026-09-08 e fim previsto em outubro de 2027 foram comunicados pelo titular em 2026-09-05; não constam do PDF.

- `cv-andre-camara.pdf`: 1 página, 461.974 bytes, criado em 2026-09-05; substituído pelo ficheiro fornecido pelo titular, sem reedição. Texto integral lido; já inclui Ciência de Dados. Subsistem o lapso `II am`, a associação do EFA a 2025 e a apresentação do curso futuro como já iniciado.
- `cv-extended-andre-camara.pdf`: substituído em 2026-09-05 pelo PDF fornecido pelo titular, 5 páginas, 174.229 bytes; texto integral lido. Inclui Ciência de Dados e competências de cibersegurança. Mantido byte a byte, sem reedição.
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

1. Posicionamento profissional: a página e o CV Padrão remoto apresentam um perfil júnior de cibersegurança. O novo CV Estendido desenvolve competências nessa área, mas mantém o cabeçalho Software Developer with Systems & Infrastructure Experience. Preferir a página atual para a procura profissional.
2. Estado do EFA: a página corrigida em 22 de agosto indica conclusão em agosto de 2026 e estágio entre julho e agosto. O CV Padrão remoto associa numa frase a conclusão do EFA e do MOOC a 2025; a data do EFA deve ser corrigida no PDF. Preferiu-se a correção explícita mais recente da página.
3. Horas de formação: 1.686h correspondem ao MOOC e EFA; 1.510h referem-se ao CET em curso. Não somar estes valores como formação já concluída nem acrescentar as 1.000h futuras de Ciência de Dados ao total concluído.
4. Proficiência: as comparações com a antiga secção `Agora` deixaram de ser atuais após a revisão remota, que passou a listar competências de cibersegurança. Os níveis das linguagens continuam a ser autoavaliações, não certificações.
5. Experiência BNP Paribas: a secção Fundação agrega `2016–2024, Lisboa & Madrid`; os CVs detalham dois períodos, 2016–2018 em Madrid e 2019–2024 em Lisboa. A cronologia detalhada foi preferida.
6. CET: o site e o CV indicam 1.510h, estágio de 485h e início aproximado em abril de 2027. O referencial oficial associado confirma a qualificação, o nível e os créditos, mas não apresenta esses dados específicos do percurso do formando.

## Informação excluída e motivo

- A motivação declarada pelo titular para Ciência de Dados foi incluída como objetivo de aprendizagem progressiva em Python, software, automação e cibersegurança. Análise de logs e identificação de padrões são aplicações pretendidas; não foram atribuídas como unidades curriculares da brochura ou resultados já demonstrados.

- Data e local de nascimento presentes no CV estendido: dados pessoais desnecessários para compreender o site.
- Estado civil e informação sobre o filho: conteúdo pessoal sem necessidade operacional para sistemas de IA.
- Imagens pessoais e familiares: não são prova de competências, qualificações ou relações.
- Contactos da Tecnisign presentes na brochura EFA: pertencem à entidade formadora, não ao titular do site.
- Saídas profissionais genéricas do certificado de Marketing Digital: descrevem possibilidades do curso, não serviços ou cargos exercidos por André Câmara.
- Frases promocionais, analogias pessoais e afirmações de impacto sem comprovação documental: mantidas fora da síntese factual.
- Anotações laterais editoriais: são comentários de apresentação e não fontes independentes.

## Lacunas identificadas

- Certificado EFA pendente, confirmado pelo titular em 2026-09-05 e indicado no cartão nas quatro línguas; não confundir a emissão pendente com curso em curso.

- Ambos os CVs incluem Ciência de Dados. O programa está disponível na formação, na dock e nos Recursos Profissionais de Oportunidades. O CET abre por defeito e os cartões de formação têm intervalo uniforme de 16 px, independentemente da sua ordem visual.
- A brochura de Ciência de Dados não indica o calendário individual, nível de qualificação nem estágio; esses dois últimos atributos não foram atribuídos ao curso no site.

- O novo CV Estendido mantém o EFA em curso e o estágio agendado para julho de 2026 (página 3), apesar da conclusão em agosto indicada no site.
- O Estendido inclui um parágrafo em português na página 2 de um documento em inglês e descreve Ciência de Dados como já em curso, antes do início previsto em 8 de setembro. O ficheiro foi publicado tal como fornecido, sem corrigir o original.
- O CV Padrão deve corrigir a frase que associa a conclusão do EFA a 2025; a página indica agosto de 2026.
- As horas previstas de formação em curso devem ser claramente diferenciadas de horas concluídas.
- Não existe documento do percurso específico da Multiformactiva que confirme publicamente 1.510h, 485h de estágio e a data aproximada de abril de 2027.
- Não existe certificado TEFL nem certificado do curso intensivo de Python entre os documentos públicos.
- Os certificados Helsinki em imagem não apresentam no próprio desenho a data de conclusão declarada no CV.
- Não existem `robots.txt` ou `sitemap.xml`.
- Não existe uma data editorial visível de última atualização do currículo.
- O site não apresenta projetos de software concretos, repositórios selecionados, estudos de caso ou resultados técnicos verificáveis, apesar de ligar ao perfil geral do GitHub.
- Não existe política de privacidade ou nota explícita sobre tratamento de dados; o site não contém formulário, mas publica contactos pessoais e instala uma PWA/service worker.

## Recomendações

- Corrigir o lapso `II am` do CV Padrão e confirmar o estado efetivo de Ciência de Dados após o início previsto e a conclusão prevista.

- Alinhar o cabeçalho do CV Estendido com o posicionamento pretendido, traduzir o parágrafo em português e corrigir as datas e estados das formações.
- Corrigir a data de conclusão do EFA no CV Padrão para corresponder à atualização explícita da página.
- Distinguir `horas concluídas` de `horas do percurso em curso`.
- Adotar uma escala única de proficiência ou remover níveis subjetivos conflitantes.
- Publicar um documento da entidade formadora que sustente a duração e o calendário específicos do CET.
- Adicionar data de última atualização ao site e aos CVs.
- Criar `robots.txt` e `sitemap.xml` com referência ao `llms.txt`.
- Rever o `llms.txt` sempre que mudar a disponibilidade ou o estado das formações, incluindo o início de Ciência de Dados.
- Considerar uma pequena secção de projetos verificáveis, com ligações diretas para código, demonstração e papel desempenhado.
- Rever a necessidade de manter dados pessoais não profissionais no CV público.

## Grau de confiança global

**Alto, com reservas.** A auditoria anterior abrangeu o conteúdo do site e sete documentos públicos; esta revisão acrescentou a leitura integral do oitavo documento, o programa de Ciência de Dados, e verificou as sete secções e os oito links documentais no browser local. Subsistem diferenças temporais entre a página e o CV Padrão, o CV Estendido desatualizado, conflitos internos assinalados e ausência de documentação pública para alguns dados específicos do CET e de formações mencionadas apenas no CV.
