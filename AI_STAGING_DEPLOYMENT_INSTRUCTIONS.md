# Staging deployment

```yaml
backend_project: avalon-manager-staging
hosting_project: avalon-manager-staging
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

- `deploy:staging` deploys Firestore rules to `avalon-manager-staging`, which is the project referenced by `firebase-applet-config.staging.json`.
- The same command deploys the built frontend to the `avalon-manager-staging` Hosting site.
- Firestore and Hosting both use the `avalon-manager-staging` Firebase project.
- Do not use `firebase.json` or a non-`staging` Vite mode for this target; they use the default production Firebase configuration.
- Verify the URL after deployment.
