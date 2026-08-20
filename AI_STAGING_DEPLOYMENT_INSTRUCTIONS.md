# Staging deployment

```yaml
project: avalon-manager-stg-260813
hosting_site: avalon-manager-stg-260813
url: https://avalon-manager-stg-260813.web.app
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
