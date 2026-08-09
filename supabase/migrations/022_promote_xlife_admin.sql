-- Promove xlifetecnologia@gmail.com a admin do ERP
DO $$
DECLARE
  v_user_id uuid;
  v_email text := 'xlifetecnologia@gmail.com';
BEGIN
  -- Busca o user em auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario % nao encontrado em auth.users. Crie a conta primeiro.', v_email;
  END IF;

  -- Insere/atualiza em erp.erp_usuarios
  INSERT INTO erp.erp_usuarios (id, email, nome, role, ativo, loja_default_id, permissoes)
  VALUES (
    v_user_id,
    v_email,
    'Xlife Tecnologia',
    'admin',
    true,
    (SELECT id FROM erp.erp_lojas ORDER BY created_at LIMIT 1),
    '{"all": true}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE
    SET role = 'admin',
        ativo = true,
        updated_at = NOW();

  RAISE NOTICE 'OK: % promovido a admin do ERP (user_id=%)', v_email, v_user_id;
END $$;

-- Confere o resultado
SELECT u.id, u.email, u.nome, u.role, u.ativo, l.apelido AS loja_default
FROM erp.erp_usuarios u
LEFT JOIN erp.erp_lojas l ON l.id = u.loja_default_id;