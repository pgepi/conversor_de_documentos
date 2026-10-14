#!/usr/bin/env python3
"""
Worker Python para LiteParse Desktop
Executa a conversão e emite eventos de progresso estruturados para o Electron
"""

import sys
import os
import argparse
import json

def main():
    parser = argparse.ArgumentParser(description="LiteParse Python Worker")
    parser.add_argument("--input", required=True, help="Arquivo de entrada")
    parser.add_argument("--output", required=True, help="Arquivo de saida")
    parser.add_argument("--format", default="markdown", choices=["markdown", "text", "json"], help="Formato de saida")
    parser.add_argument("--no-ocr", action="store_true", help="Desativar OCR")
    parser.add_argument("--ocr-lang", default="eng", help="Idioma OCR")
    args = parser.parse_args()

    input_path = os.path.abspath(args.input)
    output_path = os.path.abspath(args.output)

    if not os.path.exists(input_path):
        print(f"Erro: Arquivo {input_path} nao existe", file=sys.stderr)
        sys.exit(1)

    try:
        from liteparse import LiteParse
    except ImportError as e:
        print(f"Erro ao importar liteparse: {e}", file=sys.stderr)
        sys.exit(2)

    ocr_enabled = not args.no_ocr

    print(f"Iniciando LiteParse Python para {input_path}...")
    try:
        p = LiteParse(
            output_format=args.format,
            ocr_enabled=ocr_enabled,
            ocr_language=args.ocr_lang
        )

        # Tenta iterar por batches para enviar progresso
        pages_content = []
        total_p = 1
        try:
            for batch in p.parse_batches(input_path, batch_size=1):
                total_p = batch.total_pages or total_p
                cur_page = batch.start_page
                print(json.dumps({"event": "page", "page": cur_page, "totalPages": total_p}), flush=True)
                for page in batch.pages:
                    if args.format == "markdown":
                        pages_content.append(page.markdown or page.text or "")
                    else:
                        pages_content.append(page.text or "")
        except Exception as batch_ex:
            # Fallback para parse direto
            print(f"Aviso no batch parse ({batch_ex}), executando parse direto...", file=sys.stderr)
            res = p.parse(input_path)
            total_p = res.total_pages or len(res.pages) if res.pages else 1
            print(json.dumps({"event": "page", "page": total_p, "totalPages": total_p}), flush=True)
            if args.format == "markdown":
                pages_content = [pg.markdown or pg.text or "" for pg in res.pages] if res.pages else [res.text or ""]
            else:
                pages_content = [pg.text or "" for pg in res.pages] if res.pages else [res.text or ""]

        # Monta conteudo final
        if args.format == "markdown":
            final_text = "\n\n---\n\n".join(pages_content)
        elif args.format == "text":
            final_text = "\n\n".join(pages_content)
        elif args.format == "json":
            final_text = json.dumps({"source": input_path, "pages": pages_content}, indent=2)

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(final_text)

        print(json.dumps({"event": "done", "outputPath": output_path, "totalPages": total_p}), flush=True)
        sys.exit(0)

    except Exception as ex:
        print(f"Erro durante a conversao: {ex}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
