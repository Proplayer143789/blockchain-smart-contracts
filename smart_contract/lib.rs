#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod smart_contracts {
    //use parity_scale_codec::{Encode, Decode};
    //use ink_storage::traits::{PackedLayout, SpreadLayout};
    //use scale_info::TypeInfo;
    use scale_info::prelude::format;
    use scale_info::prelude::string::String;
    use scale_info::prelude::vec::Vec;
    use ink_storage::Mapping; 
    use scale_info::prelude::string::ToString;
    /*use ink::storage::{
        traits::ManualKey,
        Mapping,
    };*/
     // Almacenamiento ===========
    // PartialEq y Eq para comparar estructuras, servira para ver si la información ya fue ingresada
    // PackedLayout y SpreadLayout para poder almacenar la información en el contrato de forma eficiente
    // Si está activo el std, se activa TypeInfo. Sirve para la serializacion y deserializacion de datos
    // Es la información que el usuario ingresa
    //#[derive(Debug, Clone, PartialEq, Eq, Encode, Decode)]
    //#[cfg_attr(feature = "std", derive(TypeInfo))]
    /// #[ink::scale_derive(Encode, Decode, TypeInfo)]
    //  #[cfg_attr(
    //     feature = "std",
    //     derive(ink::storage::traits::StorageLayout)
    //  )]

    //#[ink::storage_item]
    #[ink::scale_derive(Encode, Decode, TypeInfo)]
    #[cfg_attr(
        feature = "std",
        derive(ink::storage::traits::StorageLayout,Clone)
    )]
    pub struct UserInfo {
        name: String,
        lastname: String,
        dni: String, // Servira para asociar la información y rol
        email: String,
    }
   
    // Tipos de roles
    /// Doctor = 1
    /// Paciente = 0
    


    // La información que maneja el smart contract
    #[ink(storage)]
    pub struct AccessControl{
        // Asociar una clave privada con el DNI
        accounts: Mapping<String, [Option<AccountId>; 2]>,
        // La información asociada a la cuenta
        users: Mapping<AccountId, UserInfo>,
        // El rol asociada a la cuenta
        roles: Mapping<AccountId, u8>,
        // Para asociar el paciente cel mapeo de los permisos por doctor
        permissions: Mapping<(AccountId, AccountId), bool>,
        // Lista de quienes tienen permisos 
        grantees: Mapping<AccountId, Vec<AccountId>>,
        access_requests: Mapping<AccountId, Vec<AccountId>>,

    }

    
    impl AccessControl {
        // Es el constructor por default, se deben colocar todos los campos de la estructura
        // Constructor
        #[ink(constructor)]
        pub fn default() -> Self {
            Self { 
                users: Mapping::default(),
                roles: Mapping::default(),
                accounts: Mapping::default(),
                permissions: Mapping::default(),
                grantees: Mapping::default(),
                access_requests: Mapping::default(),
            }
        }

        
        // Funciones
        // Ver si la información existe, si el dni existe, la información ya fue ingresada
        #[ink(message)]
        pub fn user_exists(&self, clave_privada : AccountId) -> bool {
            self.users.contains(clave_privada)
        }

        // Asignar un rol a un usuario que está creando cuenta
        /*#[ink(message)]
        pub fn assign_role(&mut self, clave_privada : AccountId, role: u8)->String {
            // Si ya existe el dni al rol que se quiere crear, es true
            let did_user_exist  = self.roles.get(clave_privada)== Some(role);
            // El doctor puede crearse una cuenta de paciente
            if !did_user_exist {
                self.roles.insert(clave_privada, &role);
                
                format!("Se asignó el rol {} a la cuenta {:?}", role, clave_privada)
            }else{
                format!("La cuenta {:?} ya tiene el rol {}", clave_privada, role)
            }
        }*/
        
        // Función para solicitar acceso
        #[ink(message)]
        pub fn request_access(&mut self, doctor_id: AccountId, patient_id: AccountId) -> String {
            if let Some(role) = self.roles.get(doctor_id) {
                if role == 1 { // Suponiendo que el rol de doctor es 1
                    let mut requests = self.access_requests.get(patient_id).unwrap_or(Vec::new());
                    if !requests.contains(&doctor_id) {
                        requests.push(doctor_id); // Agrega la solicitud de acceso
                        self.access_requests.insert(patient_id, &requests);
                        return format!("Solicitud de acceso enviada de doctor {:?} a paciente {:?}", doctor_id, patient_id);
                    } else {
                        return format!("El doctor {:?} ya ha solicitado acceso al paciente {:?}", doctor_id, patient_id);
                    }
                }
            }
            return format!("El usuario no tiene el rol de doctor")
        }

        // Función para aprobar acceso
        #[ink(message)]
        pub fn approve_access(&mut self, patient_id: AccountId, doctor_id: AccountId, approve: bool) -> String {
            if let Some(mut requests) = self.access_requests.get(patient_id) {
                if let Some(pos) = requests.iter().position(|&x| x == doctor_id) {
                    requests.swap_remove(pos); // Elimina la solicitud de acceso
                    self.access_requests.insert(patient_id, &requests);

                    if approve {
                        self.grant_permission(patient_id, doctor_id); // Otorga el permiso si el paciente aprueba
                        return format!("Acceso aprobado para el doctor {:?} al paciente {:?}", doctor_id, patient_id);
                    } else {
                        return format!("Acceso denegado para el doctor {:?} al paciente {:?}", doctor_id, patient_id);
                    }
                }
            }
            return format!("No hay solicitud de acceso pendiente para este doctor")
        }

        #[ink(message)]
        pub fn assign_role(&mut self, clave_privada: AccountId, role: u8, user_info: UserInfo) -> String {
            // Verifica si el DNI ya está asociado a dos cuentas con roles diferentes
            if let Some(mut accounts) = self.accounts.get(user_info.dni.clone()) {
                // Verifica el primer elemento
                if let Some(existing_account) = accounts[0] {
                    if let Some(existing_role) = self.roles.get(existing_account) {
                        if (existing_role == 1 && role == 1) || (existing_role == 0 && role == 0) {
                            return format!("El DNI {} ya está asociado a una cuenta con el rol {}", user_info.dni, role);
                        }
                    }
                } else {
                    // Si el primer elemento está vacío, asigna la cuenta aquí
                    accounts[0] = Some(clave_privada);
                    self.accounts.insert(user_info.dni.clone(), &accounts);
                    self.roles.insert(clave_privada, &role);
                    self.users.insert(clave_privada, &user_info);
                    return format!("Se asignó el rol {} a la cuenta {:?}", role, clave_privada);
                }

                // Verifica el segundo elemento
                if let Some(existing_account) = accounts[1] {
                    if let Some(existing_role) = self.roles.get(existing_account) {
                        if (existing_role == 1 && role == 1) || (existing_role == 0 && role == 0) {
                            return format!("El DNI {} ya está asociado a una cuenta con el rol {}", user_info.dni, role);
                        }
                    }
                } else {
                    // Si el segundo elemento está vacío, asigna la cuenta aquí
                    accounts[1] = Some(clave_privada);
                    self.accounts.insert(user_info.dni.clone(), &accounts);
                    self.roles.insert(clave_privada, &role);
                    self.users.insert(clave_privada, &user_info);
                    return format!("Se asignó el rol {} a la cuenta {:?}", role, clave_privada);
                }

                // Si ambos elementos están ocupados y no se puede asignar el rol
                return format!("El DNI {} ya está asociado a cuentas de doctor y paciente", user_info.dni);
            } else {
                // Si no hay cuentas asociadas a este DNI, crea una nueva matriz y almacena la cuenta
                let mut new_accounts = [None, None];
                new_accounts[0] = Some(clave_privada);
                self.accounts.insert(user_info.dni.clone(), &new_accounts);
            }
            
            // Asigna el rol y guarda la información del usuario
            self.roles.insert(clave_privada, &role);
            self.users.insert(clave_privada, &user_info);

            format!("Se asignó el rol {} a la cuenta {:?}", role, clave_privada)
        }

        // Prueba de assign_role
        pub fn assign_role_prueba(&mut self, clave_privada: AccountId, role: u8, dni: String) -> String {
            // Verifica si el DNI ya está asociado a dos cuentas con roles diferentes
            if let Some(mut accounts) = self.accounts.get(dni.clone()) {
                // Verifica el primer elemento
                if let Some(existing_account) = accounts[0] {
                    if let Some(existing_role) = self.roles.get(existing_account) {
                        if (existing_role == 1 && role == 1) || (existing_role == 0 && role == 0) {
                            return format!("El DNI {} ya está asociado a una cuenta con el rol {}", dni, role);
                        }
                    }
                } else {
                    // Si el primer elemento está vacío, asigna la cuenta aquí
                    accounts[0] = Some(clave_privada);
                    self.accounts.insert(dni.clone(), &accounts);
                    self.roles.insert(clave_privada, &role);
                    return format!("Se asignó el rol {} a la cuenta {:?}", role, clave_privada);
                }
        
                // Verifica el segundo elemento
                if let Some(existing_account) = accounts[1] {
                    if let Some(existing_role) = self.roles.get(existing_account) {
                        if (existing_role == 1 && role == 1) || (existing_role == 0 && role == 0) {
                            return format!("El DNI {} ya está asociado a una cuenta con el rol {}", dni, role);
                        }
                    }
                } else {
                    // Si el segundo elemento está vacío, asigna la cuenta aquí
                    accounts[1] = Some(clave_privada);
                    self.accounts.insert(dni.clone(), &accounts);
                    self.roles.insert(clave_privada, &role);
                    return format!("Se asignó el rol {} a la cuenta {:?}", role, clave_privada);
                }
        
                // Si ambos elementos están ocupados y no se puede asignar el rol
                return format!("El DNI {} ya está asociado a cuentas de doctor y paciente", dni);
            } else {
                // Si no hay cuentas asociadas a este DNI, crea una nueva matriz y almacena la cuenta
                let mut new_accounts = [None, None];
                new_accounts[0] = Some(clave_privada);
                self.accounts.insert(dni.clone(), &new_accounts);
            }
            
            // Asigna el rol
            self.roles.insert(clave_privada, &role);
        
            format!("Se asignó el rol {} a la cuenta {:?}", role, clave_privada)
        }

        // Verifica si tiene un rol
        #[ink(message)]
        pub fn user_role(&self, clave_privada: AccountId) -> bool {
            self.roles.contains(clave_privada)
        }

        // Añade la información y el usuario
        #[ink(message)]
        pub fn add_user(&mut self, clave_privada: AccountId, user_info: UserInfo) -> Result<(), String> {
            // Comprobación de la longitud de los campos y que no estén vacíos
            if user_info.name.is_empty() || user_info.name.len() > 12 {
                return Err("El nombre no puede estar vacío y debe tener menos de 50 caracteres".to_string());
            }
            if user_info.lastname.is_empty() || user_info.lastname.len() > 12 {
                return Err("El apellido no puede estar vacío y debe tener menos de 50 caracteres".to_string());
            }
            if user_info.dni.is_empty() || user_info.dni.len() > 10 {
                return Err("El DNI no puede estar vacío y debe tener menos de 10 caracteres".to_string());
            }
            if user_info.email.is_empty() || user_info.email.len() > 20 {
                return Err("El correo electrónico no puede estar vacío y debe tener menos de 50 caracteres".to_string());
            }
        
            // Si todas las comprobaciones pasan, inserta el usuario
            self.users.insert(clave_privada, &user_info);
            Ok(())
        }
        
        // Trae el rol del usuario
        #[ink(message)]
        pub fn get_role(&mut self, clave_privada: AccountId)->Option<u8> {
            self.roles.get(clave_privada)
        }
    
        // Permisos
        // Otorga rol
        #[ink(message)]
        pub fn grant_permission(&mut self, granter: AccountId, grantee: AccountId) {
            self.permissions.insert((granter, grantee), &true);
            let mut grantees = self.grantees.get(granter).unwrap_or(Vec::new());
            if !grantees.contains(&grantee) {
                grantees.push(grantee);
                self.grantees.insert(granter, &grantees);
            }
        }

        

        // Revoca permiso
        #[ink(message)]
        pub fn revoke_permission(&mut self, granter: AccountId, grantee: AccountId) {
            self.permissions.insert((granter, grantee), &false);
            if let Some(mut grantees) = self.grantees.get(granter) {
                if let Some(pos) = grantees.iter().position(|&x| x == grantee) {
                    grantees.swap_remove(pos);
                    self.grantees.insert(granter, &grantees);
                }
            }
        }

        // Verifica si tiene permiso
        #[ink(message)]
        pub fn has_permission(&self, granter: AccountId, grantee: AccountId) -> bool {
            self.permissions.get((granter, grantee)).unwrap_or(false)
        }
        
        // Trae todo las personas de las que se tiene permiso
        #[ink(message)]
        pub fn get_grantees(&self, granter: AccountId) -> Vec<AccountId> {
            self.grantees.get(granter).unwrap_or(Vec::new())
        }
    }

    // Tests
    #[cfg(test)]
    mod tests {
        /// Imports all the definitions from the outer scope so we can use them here.
        use super::*;

        /// We test if the default constructor does its job.
        #[ink::test]
        fn default_works() {
            let mut access_control = AccessControl::default();
            // En los tests, puedes usar AccountId::default() o crear uno específico con AccountId::from([u8; 32])
            let account_id = AccountId::from([0u8; 32]);
            assert_eq!(access_control.get_role(account_id), None);
        }

        #[ink::test]
        fn test_add_user_and_user_exists() {
            let mut access = AccessControl::default();
            let account_id = AccountId::from([0u8; 32]);
            let user_info = UserInfo {
                name: String::from("Alice"),
                lastname: String::from("Prueba"),
                email: String::from("nxhm@gmail.com"),
                dni: String::from("74493233"),
            
            }; // Asume que UserInfo tiene un método new

            // Asegúrate de que el usuario no exista al principio
            assert_eq!(access.user_exists(account_id.clone()), false);

            // Añade el usuario
            let _ =  access.add_user(account_id.clone(), user_info);

            // Ahora el usuario debería existir
            assert_eq!(access.user_exists(account_id.clone()), true);
        }

        #[ink::test]
        fn test_permision() {
            let mut access = AccessControl::default();
            let alice = AccountId::from([0u8; 32]);
            let bob = AccountId::from([0u8; 32]);

            // Da permiso
            access.grant_permission(alice, bob);

            // Verifica permiso
            let has_perm = access.has_permission(alice, bob);
            assert_eq!(has_perm, true);

            // Revoca permiso
            access.revoke_permission(alice, bob);

            // Verifica permiso
            let has_perm = access.has_permission(alice, bob);
            assert_eq!(has_perm, false);


        }
    }
}