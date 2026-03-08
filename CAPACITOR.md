# Forchette & Polpette – Build per Play Store e App Store (Capacitor)

## Comandi utili

| Comando | Descrizione |
|--------|-------------|
| `npm run build` | Build del sito (output in `dist/`) |
| `npm run cap:sync` | Build + copia in Android/iOS e sincronizza |
| `npm run cap:assets` | Genera icone e splash da `resources/` (vedi sotto) |
| `npm run cap:open:android` | Apre il progetto in Android Studio |
| `npm run cap:open:ios` | Apre il progetto in Xcode (solo su Mac) |

## Icone e splash

1. Metti in **`resources/`**:
   - **icon.png** – 1024×1024 px
   - **splash.png** – 2732×2732 px (opzionale: **splash-dark.png** per tema scuro)

2. Esegui:
   ```bash
   npm run cap:assets
   ```

3. Poi:
   ```bash
   npm run cap:sync
   ```

Se non aggiungi questi file, l’app userà le icone di default di Capacitor.

## Android (Play Store)

1. `npm run cap:sync`
2. `npm run cap:open:android`
3. In Android Studio: **Build → Generate Signed Bundle / APK** per creare l’AAB da caricare su Play Console.

## iOS (App Store) – solo su Mac

1. Installa le dipendenze CocoaPods (Xcode):
   ```bash
   npx cap add ios
   npm run cap:sync
   npm run cap:open:ios
   ```
2. In Xcode configura signing e crea l’archivio per l’invio all’App Store.

## Privacy

L’**Informativa privacy** è in **`public/privacy.html`**. In app il link **«Informativa privacy»** è visibile in Home (sotto «Cancella account e dati») e apre la pagina in una nuova scheda. Per gli store è consigliabile pubblicare la stessa pagina su un URL pubblico (es. il tuo sito) e usare quel link nella scheda dell’app su Play Console / App Store Connect.
