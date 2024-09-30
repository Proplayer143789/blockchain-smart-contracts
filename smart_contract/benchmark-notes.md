NXHM: estoy usando ink!5, usalo tmb. Ahora como incorporo a mi blockchain o la configuro para cuando utilice el benchmark de polkadot-sdk, funcione correctamente y no me de errores:
por ejemplo, como consigo que funcione este benchmark?
nicolas@IALB03:~/nicolas/github/polkadot-sdk$ ./target/release/polkadot benchmark storage
error: the following required arguments were not provided:
  --state-version <STATE_VERSION>

Usage: polkadot benchmark storage --state-version <STATE_VERSION>

For more information, try '--help'.

GitHub Copilot: Para configurar tu blockchain con ink! 5 y asegurarte de que el benchmark de Polkadot SDK funcione correctamente, sigue estos pasos:

1. **Configura tu entorno de desarrollo**:
   - Asegúrate de tener instalado Rust y el compilador `cargo`.
   - Instala el Polkadot SDK siguiendo las instrucciones oficiales.

2. **Configura tu contrato con ink! 5**:
   - Asegúrate de que tu contrato está correctamente configurado para ink! 5.
   - Asegúrate de que tu [`Cargo.toml`](command:_github.copilot.openRelativePath?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fhome%2Fnicolas%2Fnicolas%2Fgithub%2Fblockchain-smart-contracts%2FCargo.toml%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%220640f98e-9457-458b-ae50-1609c49684da%22%5D "/home/nicolas/nicolas/github/blockchain-smart-contracts/Cargo.toml") tiene las dependencias correctas para ink! 5.

3. **Compila tu contrato**:
   ```sh
   cargo +nightly contract build
   ```

4. **Despliega tu contrato en una cadena local**:
   - Usa una cadena local como `substrate-node` para desplegar y probar tu contrato.

5. **Ejecuta el benchmark con el parámetro requerido**:
   - El error que estás viendo indica que falta el parámetro `--state-version`. Debes proporcionarlo al comando de benchmark.

   ```sh
   ./target/release/polkadot benchmark storage --state-version 1
   ```

   Asegúrate de reemplazar `1` con la versión de estado que sea apropiada para tu configuración.

### Ejemplo de configuración en [`Cargo.toml`](command:_github.copilot.openRelativePath?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fhome%2Fnicolas%2Fnicolas%2Fgithub%2Fblockchain-smart-contracts%2FCargo.toml%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%220640f98e-9457-458b-ae50-1609c49684da%22%5D "/home/nicolas/nicolas/github/blockchain-smart-contracts/Cargo.toml") para ink! 5:
```toml
[dependencies]
ink_lang = { version = "3.0", default-features = false }
ink_storage = { version = "3.0", default-features = false }

[features]
default = ["std"]
std = [
    "ink_lang/std",
    "ink_storage/std",
]
```

### Ejemplo de despliegue en una cadena local:
1. Inicia una cadena local:
   ```sh
   substrate-node --dev
   ```

2. Usa `cargo-contract` para desplegar tu contrato:
   ```sh
   cargo +nightly contract deploy --suri //Alice --execute
   ```

### Ejecutar el benchmark:
Asegúrate de que tu nodo está corriendo y luego ejecuta el benchmark con el parámetro `--state-version`:
```sh
./target/release/polkadot benchmark storage --state-version 1
```

Estos pasos deberían ayudarte a configurar tu entorno y ejecutar el benchmark correctamente.


error[E0437]: type `BenchmarkHelper` is not a member of trait `pallet_assets::Config`
    --> /home/nicolas/nicolas/github/blockchain-smart-contracts/runtime/src/assets_config.rs:39:2
     |
  39 |     type BenchmarkHelper = (); // Para benchmark
     |     ^^^^^^^^^^^^^^^^^^^^^^^^^^ not a member of trait `pallet_assets::Config`

  For more information about this error, try `rustc --explain E0437`.
  error: could not compile `contracts-node-runtime` (lib) due to 1 previous error
    Building [=====================> ] 1396/1406: rococo-runtime(build)      