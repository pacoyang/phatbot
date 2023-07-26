#![cfg_attr(not(feature = "std"), no_std, no_main)]

extern crate alloc;

pub use phatbot_profile::*;

#[ink::contract]
mod phatbot_profile {
    use alloc::{format, str::FromStr, string::String, vec, vec::Vec};
    use ethabi::{ParamType, Token};
    #[cfg(feature = "std")]
    use ink::storage::traits::StorageLayout;
    use pink_extension::chain_extension::signing;
    use pink_json as json;
    use pink_web3::{
        signing::Key,
        transports::{pink_http::PinkHttp, resolve_ready},
        types::{Bytes, TransactionParameters, TransactionRequest, U256},
    };
    use primitive_types::{H160, H256};
    use scale::{Decode, Encode};

    const NFT_ABI: &[u8] = include_bytes!("./nft.abi.json");

    #[ink(storage)]
    pub struct PhatbotProfile {
        owner: AccountId,
        admin: AccountId,
        tg_id: String,
        evm_account: ExternalAccount,
    }

    #[derive(Encode, Decode, PartialEq, Debug)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo, StorageLayout))]
    pub enum ExternalAccountType {
        Imported,
        Generated,
    }

    #[derive(Encode, Decode, Debug)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo, StorageLayout))]
    pub struct ExternalAccount {
        account_type: ExternalAccountType,
        rpc: String,
        sk: [u8; 32],
    }

    #[derive(Encode, Decode, Debug)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        BadOrigin,
        BadUnsignedTransaction,
        FailedToSignTransaction(String),
        BadToAddress,
        BadAbi,
        BadParams(String),
        BadTransaction,
        FailedToSendTransaction(String),
    }

    pub type Result<T> = core::result::Result<T, Error>;

    impl PhatbotProfile {
        #[ink(constructor)]
        pub fn new(tg_id: String, admin: AccountId) -> Self {
            let random = signing::derive_sr25519_key(tg_id.as_bytes());
            let sk = random[..32].try_into().unwrap();
            let evm_account = ExternalAccount {
                sk,
                rpc: String::from("https://rpc-mumbai.maticvigil.com"),
                account_type: ExternalAccountType::Generated,
            };
            Self {
                tg_id,
                admin,
                evm_account,
                owner: Self::env().caller(),
            }
        }

        #[ink(message)]
        pub fn get_tg_id(&self) -> Result<String> {
            self.ensure_owner()?;
            Ok(self.tg_id.clone())
        }

        #[ink(message)]
        pub fn get_evm_account_address(&self) -> Result<H160> {
            let sk = pink_web3::keys::pink::KeyPair::from(self.evm_account.sk);
            Ok(sk.address())
        }

        #[ink(message)]
        pub fn get_evm_account_sk(&self) -> Result<String> {
            self.ensure_owner()?;
            Ok(hex::encode(self.evm_account.sk))
        }

        #[ink(message)]
        pub fn mint(&self, gas: U256) -> Result<H256> {
            if self.env().caller() != self.admin {
                return Err(Error::BadOrigin);
            }
            let address = self.get_evm_account_address().unwrap();
            let params = vec![address.as_bytes().to_vec()];
            let tx = self
                .build_transaction(
                    String::from("0x577318AB2Fe3041D26eB199fD7f16ca019e7DaDF"),
                    NFT_ABI.to_vec(),
                    String::from("mintTo"),
                    params,
                    gas,
                )
                .unwrap();
            let tx = self.sign_evm_transaction(tx).unwrap();
            self.send_transaction(tx)
        }

        pub fn build_transaction(
            &self,
            to: String,
            abi: Vec<u8>,
            func: String,
            params: Vec<Vec<u8>>,
            gas: U256,
        ) -> Result<Vec<u8>> {
            let to = H160::from_str(to.as_str()).map_err(|_| Error::BadToAddress)?;
            let abi: ethabi::Contract = json::from_slice(&abi).map_err(|_| Error::BadAbi)?;
            let data = abi
                .function(&func)
                .and_then(|function| {
                    let inputs = function.inputs.clone();
                    if inputs.len() != params.len() {
                        return Err(ethabi::Error::InvalidData);
                    }
                    let param_tokens: Vec<Token> = inputs
                        .iter()
                        .enumerate()
                        .map(|(i, token)| {
                            let value = match token.kind {
                                ParamType::Address => {
                                    let param: [u8; 20] = params[i].clone().try_into().unwrap();
                                    Token::Address(H160(param))
                                }
                                ParamType::Bytes => Token::Bytes(params[i].clone()),
                                // TODO: handle other types
                                _ => Token::Bytes(params[i].clone()),
                            };
                            value
                        })
                        .collect();
                    function.encode_input(&param_tokens)
                })
                .map_err(|err| Error::BadParams(format!("{:?}", err)))?;

            let tx = TransactionRequest {
                to: Some(to),
                data: Some(Bytes(data)),
                gas: Some(gas),
                ..Default::default()
            };
            let tx = json::to_vec(&tx).map_err(|_| Error::BadTransaction)?;
            Ok(tx)
        }

        pub fn send_transaction(&self, tx: Vec<u8>) -> Result<H256> {
            let phttp = PinkHttp::new(self.evm_account.rpc.clone());
            let web3 = pink_web3::Web3::new(phttp);

            let tx_id = web3
                .eth()
                .send_raw_transaction(tx.into())
                .resolve()
                .map_err(|err| Error::FailedToSendTransaction(format!("{:?}", err)))?;
            Ok(tx_id)
        }

        pub fn sign_evm_transaction(&self, tx: Vec<u8>) -> Result<Vec<u8>> {
            let phttp = PinkHttp::new(self.evm_account.rpc.clone());
            let web3 = pink_web3::Web3::new(phttp);
            let sk: pink_web3::keys::pink::KeyPair =
                pink_web3::keys::pink::KeyPair::from(self.evm_account.sk);

            let tx: TransactionRequest =
                json::from_slice(&tx).or(Err(Error::BadUnsignedTransaction))?;
            let tx = TransactionParameters {
                nonce: tx.nonce,
                to: tx.to,
                gas: tx.gas.unwrap_or_default(),
                gas_price: tx.gas_price,
                value: tx.value.unwrap_or_default(),
                data: tx.data.unwrap_or_default(),
                transaction_type: tx.transaction_type,
                access_list: tx.access_list,
                max_priority_fee_per_gas: tx.max_priority_fee_per_gas,
                ..Default::default()
            };

            let signed_tx = resolve_ready(web3.accounts().sign_transaction(tx, &sk))
                .map_err(|err| Error::FailedToSignTransaction(format!("{:?}", err)))?;

            Ok(signed_tx.raw_transaction.0)
        }

        fn ensure_owner(&self) -> Result<()> {
            if self.env().caller() == self.owner {
                Ok(())
            } else {
                Err(Error::BadOrigin)
            }
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[ink::test]
        fn it_works() {
            pink_extension_runtime::mock_ext::mock_all_ext();
            let phatbot_profile = PhatbotProfile::new(347828988, AccountId::from([1u8; 32]));
            let result = phatbot_profile.get_evm_account_address();
            assert!(result.is_ok());
        }

        #[ink::test]
        fn build_transaction_works() {
            pink_extension_runtime::mock_ext::mock_all_ext();
            let phatbot_profile = PhatbotProfile::new(347828988, AccountId::from([1u8; 32]));
            let address = phatbot_profile.get_evm_account_address().unwrap();
            println!("address: {:?}", address);
            let tx = phatbot_profile.mint(U256::from(70_000)).unwrap();
            println!("tx: {:#?}", tx);
        }
    }
}
