# Phase 21.7: Startzeit & Dateigröße — Optimierungsplan

**Status:** WIP - Profiling Setup + Roadmap fertig  
**Branch:** claude/phase-21.7-optimize  
**Ziel:** 426 KB → 400 KB gzipped (6% Reduktion)

## ✅ Abgeschlossen

### Profiling-Infrastruktur
- [x] Performance-Marks in index.html hinzugefügt (window.onload phase tracking)
- [x] Startup-Messung-Script erstellt (scripts/measure-startup.js)
- [x] Codebase-Analyse durchgeführt (35K Zeilen JS, 88 Dateien)

### Größte Module identifiziert
- match.js: 2579 Zeilen (7.4% der Codebasis)
- stadium.js: 1246 Zeilen (3.6%)
- squad.js: 975 Zeilen (2.8%)
- finances.js: 942 Zeilen (2.7%)
- secondteam.js: 892 Zeilen (2.6%)

## 🔧 Optimierungspipeline (Ready to Execute)

### Phase 21.7a: Daten-Optimierung (1-2h)
1. **LEXICON_ENTRIES komprimieren** (~20-30 KB)
   - 52 Einträge mit vollem Text + Tips
   - Lösung: Categories als Bitvector, separate Tips-DB
   - Risk: LOW

2. **CSS-Kommentare reduzieren** (~5-10 KB)
   - 1564 Zeilen mit vielen inline-Erklärungen
   - Lösung: Auf essenzielle Comments reduzieren
   - Risk: LOW

3. **Redundante Daten eliminieren** (~5-10 KB)
   - Doppelte Club-Namen, unnecessary structure
   - Lösung: Generate statt hardcode
   - Risk: LOW

### Phase 21.7b: Code-Splitting (2-3h)
1. **match.js aufteilen** (2579 Zeilen)
   ```
   match.js (900 Z) → Kern-Logic
   match-setup.js (400 Z) → setupMatch, startMatchdayFlow
   match-live.js (1200 Z) → simulateMatchStep, Live-Engine
   match-post.js (79 Z) → processPostMatchRoutine
   ```
   - Impact: +5% size reduction, bessere Wartbarkeit
   - Risk: MEDIUM (globale Variable, Dependencies)
   - Validierung: Full test suite nach Split

2. **stadium.js / squad.js evaluieren** (~1200 Zeilen gesamt)
   - Zu groß für einzelne Dateien
   - Candidates für Split: stadium-maintenance.js, squad-development.js
   - Risk: MEDIUM

### Phase 21.7c: Lazy Loading (1-2h)
**Nur laden wenn geöffnet** (150-200 KB potential)
1. Admin-Screen (admin.js - 473 Zeilen)
2. Hall of Fame (hall-of-fame.js - 335 Zeilen)  
3. Lexicon (lexicon.js - 215 Zeilen)
4. Achievements (achievements.js - 51 Zeilen)

**Implementierung:**
- Dynamisches Script-Loading per Screen
- Fallback für offline/slow networks
- Browser-native Approach (kein Framework)

## 📊 Erwartete Ergebnisse

| Phase | Files changed | Size reduction | Risk | Time |
|-------|---|---|---|---|
| 21.7a | 3 files | ~6% (26 KB gzipped) | LOW | 1-2h |
| 21.7b | 5 files | ~5% (20 KB gzipped) | MEDIUM | 2-3h |
| 21.7c | 4 files | ~10% (43 KB gzipped) | MEDIUM | 1-2h |
| **Total** | **12 files** | **~21% (90 KB)** | **MEDIUM** | **4-7h** |

## 🎯 Nächste Schritte

### For Next Session:
```bash
# Start Phase 21.7a
git checkout claude/phase-21.7-optimize
npm run serve
# Edit js/lexicon.js, css/styles.css for data compression
npm run check  # Build + test
git commit -m "Optimize: Lexicon & CSS compression"
```

### Success Criteria:
- ✅ All tests pass (npm test)
- ✅ Gzipped size < 400 KB
- ✅ Startup time < 3 seconds (mobile 4G)
- ✅ No visual changes to UI
- ✅ All screens load without errors

## 📝 Notes

- Profiling instrumentation is in place but not yet used for measurement
- match.js Split is feasible but needs careful testing (81 functions, ~100 dependencies)
- Lazy Loading is orthogonal to other optimizations - can be done independently
- Consider pairing with Phase 21.8 (English) since both modify data structures

---
*Phase 21.7 is a performance optimization phase with no new features - pure technical debt cleanup.*
