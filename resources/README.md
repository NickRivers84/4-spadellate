# Icone e splash per Capacitor (Play Store / App Store)

Per generare icone e splash screen per Android e iOS:

1. **Aggiungi le immagini sorgente** in questa cartella:
   - **icon.png** – 1024×1024 px (logo dell’app, senza trasparenza per Android)
   - **splash.png** – 2732×2732 px (splash screen; il logo può essere al centro)
   - (Opzionale) **splash-dark.png** – per tema scuro
   - (Opzionale) **icon-foreground.png** e **icon-background.png** – per Android adaptive icon

2. **Genera le risorse**:
   ```bash
   npx @capacitor/assets generate
   ```

3. **Sincronizza e apri il progetto**:
   ```bash
   npm run cap:sync
   npm run cap:open:android
   ```
   Per iOS: `npm run cap:open:ios` (solo su Mac).

Senza `icon.png` e `splash.png` l’app userà le icone di default di Capacitor.
