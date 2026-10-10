BEGIN;

INSERT INTO clients (
  id, company_name, trade_name, tax_id, industry, website, phone, email,
  postal_code, street, street_number, complement, city, state, country, notes, logo_path
) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Aurora Tecnologia e Dados Ltda.', 'Aurora Tech', '12.345.678/0001-90', 'Tecnologia da Informação', 'https://auroratech.example.com', '+55 11 3333-1000', 'contato@auroratech.example.com', '04538-132', 'Av. Faria Lima', '3477', '10º andar', 'São Paulo', 'SP', 'Brasil', 'Cliente estratégico; interesse em automação comercial e integração de dados.', '/company-logos/aurora-tech.svg'),
  ('22222222-2222-4222-8222-222222222222', 'Verde Vivo Produtos Naturais S.A.', 'Verde Vivo', '23.456.789/0001-01', 'Varejo e produtos naturais', 'https://verdevivo.example.com', '+55 41 3333-2000', 'relacionamento@verdevivo.example.com', '80420-090', 'Rua Comendador Araújo', '731', 'Conjunto 42', 'Curitiba', 'PR', 'Brasil', 'Expansão do e-commerce e revisão do processo de relacionamento com clientes.', '/company-logos/verde-vivo.svg'),
  ('33333333-3333-4333-8333-333333333333', 'Horizonte Engenharia e Construções Ltda.', 'Horizonte Engenharia', '34.567.890/0001-12', 'Engenharia e construção', 'https://horizonteengenharia.example.com', '+55 31 3333-3000', 'contato@horizonteengenharia.example.com', '30112-000', 'Av. do Contorno', '6594', 'Sala 801', 'Belo Horizonte', 'MG', 'Brasil', 'Empresa em fase de avaliação de solução para organizar carteira de obras e contatos.', '/company-logos/horizonte-engenharia.svg')
ON CONFLICT (id) DO UPDATE SET
  company_name=EXCLUDED.company_name, trade_name=EXCLUDED.trade_name, tax_id=EXCLUDED.tax_id,
  industry=EXCLUDED.industry, website=EXCLUDED.website, phone=EXCLUDED.phone, email=EXCLUDED.email,
  postal_code=EXCLUDED.postal_code, street=EXCLUDED.street, street_number=EXCLUDED.street_number,
  complement=EXCLUDED.complement, city=EXCLUDED.city, state=EXCLUDED.state, country=EXCLUDED.country,
  notes=EXCLUDED.notes, logo_path=EXCLUDED.logo_path, updated_at=NOW();

INSERT INTO contacts (
  id, client_id, full_name, job_title, email, phone, mobile, birthday, linkedin_url, notes, is_primary
) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'Mariana Costa', 'Diretora de Operações', 'mariana.costa@auroratech.example.com', '+55 11 3333-1001', '+55 11 99911-1001', '1987-04-18', 'https://www.linkedin.com/in/mariana-costa-crm', 'Responsável pela decisão e patrocinadora do projeto.', TRUE),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'Rafael Mendes', 'Gerente de Tecnologia', 'rafael.mendes@auroratech.example.com', '+55 11 3333-1002', '+55 11 99911-1002', '1990-09-06', 'https://www.linkedin.com/in/rafael-mendes-tech', 'Contato técnico para integrações e segurança.', FALSE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '22222222-2222-4222-8222-222222222222', 'Camila Oliveira', 'CEO', 'camila.oliveira@verdevivo.example.com', '+55 41 3333-2001', '+55 41 99922-2001', '1984-11-23', 'https://www.linkedin.com/in/camila-oliveira-varejo', 'Contato principal; prefere reuniões no período da manhã.', TRUE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '22222222-2222-4222-8222-222222222222', 'João Pedro Lima', 'Coordenador de E-commerce', 'joao.lima@verdevivo.example.com', '+55 41 3333-2002', '+55 41 99922-2002', '1992-02-14', 'https://www.linkedin.com/in/joao-pedro-lima-ecommerce', 'Responsável pelos canais digitais e catálogo online.', FALSE),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '33333333-3333-4333-8333-333333333333', 'Fernanda Alves', 'Diretora Comercial', 'fernanda.alves@horizonteengenharia.example.com', '+55 31 3333-3001', '+55 31 99933-3001', '1986-07-09', 'https://www.linkedin.com/in/fernanda-alves-eng', 'Contato principal para propostas e contratos.', TRUE),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', '33333333-3333-4333-8333-333333333333', 'Lucas Ribeiro', 'Engenheiro de Projetos', 'lucas.ribeiro@horizonteengenharia.example.com', '+55 31 3333-3002', '+55 31 99933-3002', '1991-12-02', 'https://www.linkedin.com/in/lucas-ribeiro-projetos', 'Apoia o levantamento de requisitos e cronogramas.', FALSE)
ON CONFLICT (id) DO UPDATE SET
  client_id=EXCLUDED.client_id, full_name=EXCLUDED.full_name, job_title=EXCLUDED.job_title,
  email=EXCLUDED.email, phone=EXCLUDED.phone, mobile=EXCLUDED.mobile, birthday=EXCLUDED.birthday,
  linkedin_url=EXCLUDED.linkedin_url, notes=EXCLUDED.notes, is_primary=EXCLUDED.is_primary, updated_at=NOW();

INSERT INTO opportunities (
  id, name, client_id, contact_id, technology, value, currency, service_type, resources,
  budget, budget_currency, notes, customer_need, offered_solution, project_hours,
  opened_at, expected_close_at, status, loss_reason
) VALUES
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'Integração de dados comerciais',
   '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
   'TypeScript, PostgreSQL', 48000.00, 'BRL', 'Projeto', 'Consultor; desenvolvedor backend; UX Designer',
   55000.00, 'BRL', 'Exemplo de oportunidade em fase de proposta.',
   'Consolidar dados hoje distribuídos em sistemas diferentes.',
   'Implementar integrações e um painel unificado para acompanhamento comercial.',
   320, CURRENT_DATE - 20, CURRENT_DATE + 25, 'Proposta', NULL),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2', 'Implantação do novo e-commerce',
   '22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
   'Shopify, APIs REST', 28500.00, 'BRL', 'Implantação', 'Consultor; desenvolvedor; especialista em e-commerce',
   30000.00, 'BRL', 'Exemplo de oportunidade em desenvolvimento.',
   'Modernizar a operação digital e facilitar a atualização do catálogo.',
   'Implantar a plataforma e integrar catálogo, estoque e pedidos.',
   200, CURRENT_DATE - 12, CURRENT_DATE + 45, 'Desenvolvimento', NULL),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd3', 'Sistema de acompanhamento de obras',
   '33333333-3333-4333-8333-333333333333', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
   'Aplicação web', 72000.00, 'USD', 'Projeto', 'Analista de negócios; desenvolvedor; QA',
   65000.00, 'USD', 'Exemplo de oportunidade perdida para demonstrar o motivo.',
   'Ter visibilidade centralizada do andamento das obras.',
   'Desenvolver uma aplicação para acompanhar cronogramas, custos e entregas.',
   480, CURRENT_DATE - 90, CURRENT_DATE - 30, 'Perdida', 'Prazo')
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name, client_id=EXCLUDED.client_id, contact_id=EXCLUDED.contact_id,
  technology=EXCLUDED.technology, value=EXCLUDED.value, currency=EXCLUDED.currency,
  service_type=EXCLUDED.service_type, resources=EXCLUDED.resources, budget=EXCLUDED.budget,
  budget_currency=EXCLUDED.budget_currency, notes=EXCLUDED.notes,
  customer_need=EXCLUDED.customer_need, offered_solution=EXCLUDED.offered_solution,
  project_hours=EXCLUDED.project_hours, opened_at=EXCLUDED.opened_at,
  expected_close_at=EXCLUDED.expected_close_at, status=EXCLUDED.status,
  loss_reason=EXCLUDED.loss_reason, updated_at=NOW();

COMMIT;
