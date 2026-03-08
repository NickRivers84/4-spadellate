# Guida: creare la Signed Bundle (AAB) per Play Store – Windows

Segui questi passi per generare il file **.aab** da caricare sulla Play Console.

---

## 1. Preparare il progetto

Nel terminale (cartella del progetto):

```bash
npm run cap:sync
```

Poi apri Android Studio:

```bash
npm run cap:open:android
```

Si aprirà Android Studio con il progetto **android**.

---

## 2. Creare una keystore (solo la prima volta)

La **keystore** è il file che serve per firmare l’app. **Conservalo e non perderlo**: senza non potrai più aggiornare l’app sugli store.

1. Apri **PowerShell** o **Prompt dei comandi**.
2. Vai in una cartella sicura (es. `C:\AndroidKeystore` o la tua home):
   ```bash
   cd %USERPROFILE%
   mkdir android-keystore
   cd android-keystore
   ```
3. Crea la keystore (sostituisci **nome**, **cognome** e **password** con i tuoi):
   ```bash
   keytool -genkey -v -keystore forchette-polpette.keystore -alias forchette-polpette -keyalg RSA -keysize 2048 -validity 10000
   ```
4. Rispondi alle domande (nome, organizzazione, città, ecc.). La **password** che scegli va ricordata: la userai sempre per firmare.
5. Si creerà il file **forchette-polpette.keystore**. **Fanne una copia di backup** (es. su cloud o USB).

---

## 3. Configurare la firma in Android Studio

1. In Android Studio: menu **File → Project Structure** (o icona con il cricchetto).
2. Scegli **Project** a sinistra e annota il **Path** del progetto (es. `C:\Users\...\4-spadellate-clean\android`).
3. Chiudi.
4. Menu **Build → Generate Signed Bundle / APK**.
5. Scegli **Android App Bundle** → **Next**.
6. **Create new...** (se è la prima volta):
   - **Key store path**: vai al file `.keystore` che hai creato (es. `C:\Users\TuoNome\android-keystore\forchette-polpette.keystore`).
   - **Password** e **Key alias**: la password della keystore e l’alias (es. `forchette-polpette`).
   - **Key password**: di solito uguale alla password della keystore.
   - Compila **First and Last Name** (o nome app) e **Validity (years)** (es. 25).
   - **OK**.
7. Se la keystore esiste già: **Choose existing...**, seleziona il file `.keystore`, inserisci password e alias → **Next**.
8. **Build Variants**: lascia **release**.
9. Spunta **Export encrypted key** se vuoi un backup della chiave (opzionale).
10. **Create**.

Android Studio genererà il file **.aab** (es. `app-release.aab`) nella cartella **android/app/release/**.

---

## 4. Trovare il file .aab

- In Android Studio: **Build → Build Bundle(s) / APK(s) → Build Bundle(s)** (oppure usa i passi sopra).
- Il file è in:  
  `android\app\build\outputs\bundle\release\app-release.aab`

Puoi aprirlo con **Esplora file** da quella cartella.

---

## 5. Caricare sulla Play Console

1. Vai su [Play Console](https://play.google.com/console).
2. Crea o apri l’app **Forchette & Polpette**.
3. **Produzione** (o **Test interno**) → **Crea nuova release**.
4. Carica il file **app-release.aab**.
5. Compila le note della release e invia in revisione.

---

## Riepilogo comandi (Windows)

```bash
# 1. Sincronizza il progetto
npm run cap:sync

# 2. Apri Android Studio
npm run cap:open:android
```

Poi in Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle** e segui i passi sopra.

---

## Problemi comuni

- **“keytool non riconosciuto”**: aggiungi il JDK al PATH. Il JDK è incluso in Android Studio; la cartella è tipo `C:\Program Files\Android\Android Studio\jbr\bin` (o `jre`). Aggiungi `...\bin` alle variabili d’ambiente **Path**.
- **“Keystore was tampered with”**: password errata. Controlla alias e password.
- **Build fallita**: in Android Studio **Build → Clean Project**, poi **Build → Rebuild Project** e riprova a generare il bundle.
