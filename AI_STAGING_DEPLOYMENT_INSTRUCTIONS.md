# Staging deployment

```yaml
project: avalon-manager-staging
hosting_site: avalon-manager-staging
url: https://avalon-manager-staging.web.app
firebase_config: firebase.staging.json
app_config: firebase-applet-config.staging.json
vite_mode: staging
```

```powershell
npm run check
npm run deploy:staging
```

- `deploy:staging` deploys Firestore rules and Hosting to the project above.
- Do not use `firebase.json` or a non-`staging` Vite mode for this target; they use the default production Firebase configuration.
- Verify the URL after deployment.
