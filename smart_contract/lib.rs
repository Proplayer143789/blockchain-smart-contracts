#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod smart_contracts {
    //use parity_scale_codec::{Encode, Decode};
    //use ink_storage::traits::{PackedLayout, SpreadLayout};
    //use scale_info::TypeInfo;
    use scale_info::prelude::format;
    use scale_info::prelude::string::String;
    use ink_storage::Mapping; 
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
        //accounts: Mapping<AccountId, String>,
        // La información asociada a la cuenta
        users: Mapping<AccountId, UserInfo>,
        // El rol asociada a la cuenta
        roles: Mapping<AccountId, u8>,
        // Para asociar el paciente cel mapeo de los permisos por doctor
        permissions: Mapping<(AccountId, AccountId), bool>,
        // Lista de quienes tienen permisos 
        grantees: Mapping<AccountId, Vec<AccountId>>,

    }

    
    impl AccessControl {
        // Es el constructor por default, se deben colocar todos los campos de la estructura
        // Constructor
        #[ink(constructor)]
        pub fn default() -> Self {
            Self { 
                users: Mapping::default(),
                roles: Mapping::default(),
                permissions: Mapping::default(),
                grantees: Mapping::default(),
            }
        }

        
        // Funciones
        // Ver si la información existe, si el dni existe, la información ya fue ingresada
        #[ink(message)]
        pub fn user_exists(&self, clave_privada : AccountId) -> bool {
            self.users.contains(clave_privada)
        }

        // Asignar un rol a un usuario que está creando cuenta
        #[ink(message)]
        pub fn assign_role(&mut self, clave_privada : AccountId, role: u8)->String {
            // Si ya existe el dni al rol que se quiere crear, es true
            let did_user_exist  = if self.roles.get(clave_privada.clone())== Some(role) {true} else {false};
            // El doctor puede crearse una cuenta de paciente
            if !did_user_exist {
                self.roles.insert(clave_privada.clone(), &role);
                return format!("Se asignó el rol {} a la cuenta {:?}", role, clave_privada);
            }else{
                return format!("La cuenta {:?} ya tiene el rol {}", clave_privada, role);

            }
        }
        
        // Verifica si tiene un rol
        #[ink(message)]
        pub fn user_role(&self, clave_privada: AccountId) -> bool {
            self.roles.contains(clave_privada)
        }

        // Añade la información y el usuario
        #[ink(message)]
        pub fn add_user(&mut self, clave_privada: AccountId, user_info: UserInfo) {
            self.users.insert(clave_privada.clone(), &user_info);
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
            self.permissions.get(&(granter, grantee)).unwrap_or(false)
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
            access.add_user(account_id.clone(), user_info);

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