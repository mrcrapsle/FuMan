#!/usr/bin/env python3
"""Fasst die Ausgabe von scripts/longrun-bundesliga.js zusammen (eine Zeile je Lauf).

    python3 scripts/auswertung.py <ausgabe.txt> [weitere.txt ...]

Pro Lauf: Saisons, Liga am Ende, Entlassungen (Saison), Talent-Erlös in M€,
abgelehnte Talentangebote, Aufstiege und Abstiege (Ligawechsel laut '→ Liga').
"""
import re
import sys

LAUF = re.compile(r'^== Lauf (\d+) \((\w+)\) ==\s*$', re.M)
ZEILE = re.compile(r'^\s*(\d+)\s+(\d+)\s+(\d+)\s+-?\d+\s')


def auswerten(text):
    teile = LAUF.split(text)
    ergebnisse = []
    for i in range(1, len(teile), 3):
        nummer, modus, body = teile[i], teile[i + 1], teile[i + 2]
        zeilen = [z for z in body.splitlines() if ZEILE.match(z)]
        if not zeilen:
            continue
        ligen = [int(ZEILE.match(z).group(2)) for z in zeilen]
        tv = sum(float(x) for z in zeilen for x in re.findall(r' TV([0-9.]+)M', z))
        ta = sum(int(x) for z in zeilen for x in re.findall(r' TA(\d+)', z))
        ent = [ZEILE.match(z).group(1) for z in zeilen if 'ENTLASSEN' in z]
        auf = sum(1 for z in zeilen if '→ Liga' in z and ligen[zeilen.index(z)] > int(re.search(r'→ Liga (\d+)', z).group(1)))
        ab = sum(1 for z in zeilen if '→ Liga' in z and ligen[zeilen.index(z)] < int(re.search(r'→ Liga (\d+)', z).group(1)))
        ergebnisse.append({
            'lauf': nummer, 'modus': modus, 'saisons': len(zeilen),
            'liga_ende': ligen[-1], 'entlassung': ','.join(ent) or '-',
            'talent_mio': tv, 'talent_abgelehnt': ta, 'aufstiege': auf, 'abstiege': ab,
        })
    return ergebnisse


def main(dateien):
    print(f"{'Datei':<28}{'Lauf':>5}{'Modus':>8}{'Saisons':>8}{'Liga Ende':>10}{'Entlass.':>10}{'Talent M€':>10}{'TA':>5}{'Auf':>5}{'Ab':>5}")
    for datei in dateien:
        with open(datei, encoding='utf-8') as f:
            text = f.read()
        for e in auswerten(text):
            print(f"{datei[-28:]:<28}{e['lauf']:>5}{e['modus']:>8}{e['saisons']:>8}{e['liga_ende']:>10}"
                  f"{e['entlassung']:>10}{e['talent_mio']:>10.1f}{e['talent_abgelehnt']:>5}{e['aufstiege']:>5}{e['abstiege']:>5}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1:])
