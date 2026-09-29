// Define the bank interface
interface Bank {
  id: number;
  name: string;
  code: string;
  bin: string;
  citad: string;
  shortName: string;
  logo: string;
  transferSupported: number;
  lookupSupported: number;
  short_name: string;
  support: number;
  isTransfer: number;
  swift_code: string | null;
}

// Define the banks response structure
interface BanksResponse {
  code: string;
  desc: string;
  data: Bank[];
}

// Function to fetch bank data from the public JSON file
const fetchBanks = async (): Promise<Bank[]> => {
  try {
    // Using fetch to get the JSON file from the public folder
    const response = await fetch('/banks.json');

    if (!response.ok) {
      throw new Error(`Failed to fetch banks.json: ${response.status} ${response.statusText}`);
    }

    const data: BanksResponse = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching bank data:', error);
    throw error;
  }
};

// Simple function to get all banks
const getAllBanks = async (): Promise<Bank[]> => {
  return await fetchBanks();
};

// Function to get bank options formatted for dropdowns
const getBankOptions = async (): Promise<{ value: string; label: string; logo?: string }[]> => {
  const banks = await fetchBanks();
  return banks.map(bank => ({
    value: bank.code,
    label: bank.name,
    logo: bank.logo
  }));
};

export { fetchBanks, getAllBanks, getBankOptions };
export type { Bank };