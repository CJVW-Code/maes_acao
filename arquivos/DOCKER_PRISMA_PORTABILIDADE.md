# Prisma + Docker: Portabilidade e Produção

Este documento explica por que estamos usando o **Prisma** como ORM para garantir que seu projeto seja fácil de mover do desenvolvimento local para o Supabase (produção).

## O Problema do Cliente Supabase no Docker
O cliente padrão do Supabase (`@supabase/supabase-js`) é excelente, mas ele depende de uma conexão via API/HTTP com a plataforma Supabase. 
- No Docker local, o banco de dados é um PostgreSQL "puro", sem as camadas de API do Supabase.
- Isso faz com que chamadas como `supabase.from('tabela')` falhem se você não estiver conectado à internet ou se não tiver chaves de API válidas no seu `.env.docker`.

## A Solução com Prisma
O Prisma se conecta **diretamente ao banco de dados** (via porta 5432). Isso traz as seguintes vantagens:

1. **Independência de Chaves**: No Docker, você só precisa da `DATABASE_URL`. Não precisa de chaves do Supabase para o banco funcionar.
2. **Mesmo Código, Qualquer Banco**: O código que escrevemos agora (`prisma.casos.findMany()`) é o **exato mesmo** que vai rodar no Supabase.
3. **Migração Transparente**: 
   - **Local:** `DATABASE_URL="postgresql://maes:maes123@db:5432/maes_em_acao"`
   - **Produção (Supabase):** `DATABASE_URL="postgresql://postgres:[SENHA]@[HOST]:5432/postgres"`

## O Papel do Supabase no Futuro
Não vamos abandonar o Supabase! Ele continuará sendo usado para:
- **Storage**: Armazenamento de PDFs e imagens.
- **Produção**: Como seu servidor de banco de dados oficial.

**Resumo:** O Prisma abstrai o banco para que você possa desenvolver offline/local agora e colocar no ar depois em 1 minuto, apenas trocando uma linha no arquivo `.env`.
