from scipy import signal
import numpy as np
from sklearn.decomposition import FastICA
import matplotlib.pyplot as plt
import json
import math
import pywt

#阈值函数
def parameterAdjustableThreshold(x, T, lambd):
    if x > lambd:
        x_hat = x * (1 - np.exp((lambd - x) / T))
    elif abs(x) <= lambd:
        x_hat = 0
    else:
        x_hat = (-x) * (np.exp((lambd + x) / T) - 1)
    return x_hat

#==================================================================================================================================
#---------------------------------------------------------------带通滤波------------------------------------------------------------
#==================================================================================================================================

def bd_filter(one_dim_signal, low_cutoff, high_cutoff, fs, order=2):
    nyquist_freq = 0.5 * fs
    low = low_cutoff / nyquist_freq
    high = high_cutoff / nyquist_freq
    b, a = signal.butter(order, [low, high], btype='band', analog=False)
    y = signal.lfilter(b, a, one_dim_signal)
    return y
    
#==================================================================================================================================
#---------------------------------------------------------------陷波器-------------------------------------------------------------
#==================================================================================================================================
def n_filter(sig, fs, freq, Q=30):
    b, a = signal.iirnotch(freq, Q, fs)
    y = signal.lfilter(b, a, sig)
    return y
#==================================================================================================================================
#-----------------------------------------------------------ICA-WT去噪-------------------------------------------------------------
#==================================================================================================================================
def ica_denoising(eeg_data, channel, n_components=None, threshold=1.0, sigma=0.1):
    """
    FastICA去噪流程
    参数：
        eeg_data: 输入EEG数据，形状为(通道数, 时间点)
        n_components: 保留的成分数量（若为None则保留全部）
        threshold: 峰度阈值，绝对值低于此值的成分将被去除
    返回：
        去噪后的EEG信号，形状与输入相同
    """
    # 数据预处理
    data = eeg_data.T  # 转换为(时间点, 通道)
    mean = data.mean(axis=0)
    data_centered = data - mean #中心化数据

    # 初始化FastICA模型
    ica = FastICA(n_components=n_components, 
                 whiten='unit-variance', 
                 random_state=0, 
                 max_iter=1000, 
                 fun='exp',
                fun_args={'level': 2},
                tol=1e-4)

    # 执行ICA分解
    components = ica.fit_transform(data_centered)

    # 计算峰度指标
    kurtosis = np.array([np.mean(component**4) - 3*(np.mean(component**2))**2 for component in components.T])
    
    # 自动成分选择（基于峰度阈值）
    keep_mask = np.abs(kurtosis) > threshold

    # 创建去噪后的成分矩阵
    components_clean = components.copy()
    components_clean[:, ~keep_mask] = 0

    #对剩余的IC分量进行小波去噪
    #print(components_clean.shape) ->(656, 64) 每一列是一个IC分量
    for index in range(channel):
        #每次对一个IC分量进行去噪
        IC = components_clean[:, index].squeeze()
        if np.array_equal(IC, np.zeros(len(IC))): #对被消去的IC分量不做处理
            continue
        J_max = round(math.log(len(IC), 2)); #最大分解层数
    
        #执行小波分解
        coeffs = pywt.wavedec(IC, "db4", level = J_max)
        # 选择阈值，例如使用通用阈值# 估计噪声水平
        threshold = sigma * np.sqrt(2 * np.log(len(IC)))  # 通用阈值

        # 对每个尺度的小波系数进行阈值处理
        #denoised_coeffs = [pywt.threshold(c, threshold, mode='soft') for c in coeffs]
        denoised_coeffs = []
        for i, c in  enumerate(coeffs):
            if i == 0: #细节系数
                denoised_coeffs.append(c)
            else:
                new_c = []
                for c_i in c:
                    new_c_i = parameterAdjustableThreshold(c_i, 1.5, threshold)
                    new_c.append(new_c_i)
                denoised_coeffs.append(np.array(new_c))

        # 小波重构
        IC_denoised = pywt.waverec(denoised_coeffs, "db4")
        IC_denoised = IC_denoised[:len(eeg_data[0])]

        #将去噪后的IC添加到components_clean当中
        components_clean[:, index] = IC_denoised

    # 信号重构
    data_clean_centered = ica.inverse_transform(components_clean)
    data_clean = data_clean_centered + mean
    return data_clean.T  # 转换回(通道, 时间点)
        